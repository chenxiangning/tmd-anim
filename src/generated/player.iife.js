(function() {
	//#region src/core/timeline.ts
	/** 配音有效时长(秒)= 原始时长 / 速率;无配音或未探测到时长返回 null */
	function sceneAudioSeconds(scene) {
		const a = scene.audio;
		if (!a || !a.duration || a.duration <= 0) return null;
		const rate = Math.min(4, Math.max(.25, a.rate ?? 1));
		return a.duration / rate;
	}
	function sceneDuration(scene) {
		let end = 0;
		for (const el of scene.elements) end = Math.max(end, el.anim.start + el.anim.duration);
		const base = Math.max(end, .1) + Math.max(0, scene.dwell ?? 0);
		return Math.max(base, sceneAudioSeconds(scene) ?? 0);
	}
	function sceneSpans(project) {
		const spans = [];
		let cursor = 0;
		project.scenes.forEach((scene, index) => {
			const duration = sceneDuration(scene);
			spans.push({
				index,
				start: cursor,
				duration,
				name: scene.name
			});
			cursor += duration;
		});
		return spans;
	}
	function projectDuration(project) {
		return sceneSpans(project).reduce((sum, span) => sum + span.duration, 0);
	}
	/** 全局时刻 t 定位到场景与场景内局部时刻,t 越界时钳到 [0, 总时长] */
	function locate(project, t) {
		const spans = sceneSpans(project);
		if (spans.length === 0) return {
			index: 0,
			localT: 0
		};
		const clamped = Math.min(Math.max(t, 0), projectDuration(project));
		for (const span of spans) if (clamped < span.start + span.duration) return {
			index: span.index,
			localT: clamped - span.start
		};
		const last = spans[spans.length - 1];
		return {
			index: last.index,
			localT: last.duration
		};
	}
	function clamp01(v) {
		return Math.min(1, Math.max(0, v));
	}
	function easeOutCubic(p) {
		const q = 1 - clamp01(p);
		return 1 - q * q * q;
	}
	function easeInOutCubic(p) {
		const x = clamp01(p);
		return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
	}
	/** 回弹缓动:终点恰为 1,中途允许超过 1(用于 pop 的过冲缩放) */
	function easeOutBack(p) {
		const c1 = 1.70158;
		const c3 = 2.70158;
		const x = clamp01(p) - 1;
		return 1 + c3 * x * x * x + c1 * x * x;
	}
	//#endregion
	//#region src/core/audioSync.ts
	/** 每元素上一帧的场景内时刻,用于识别「播放头跳变」 */
	var lastLocal = /* @__PURE__ */ new WeakMap();
	/** 上次检查时的墙钟与音频时钟:判「真停走」必须以跨帧的墙钟间隔为基准 */
	var lastBeat = /* @__PURE__ */ new WeakMap();
	/** 起播进行中:play() 未落地前不再反复 seek+play(否则互相打断,听感断续) */
	var starting = /* @__PURE__ */ new WeakSet();
	/**
	* 池增量维护:src 未变的元素复用,变化的重建,不再引用的暂停后移除。
	* 编辑器每次 commit 都产生新 project 对象,必须复用未变的 audio 元素。
	*/
	function upsertSceneAudioPool(pool, project) {
		const alive = /* @__PURE__ */ new Set();
		for (const scene of project.scenes) {
			const src = scene.audio?.src;
			if (!src) continue;
			alive.add(scene.id);
			const existing = pool.get(scene.id);
			if (existing && existing.dataset.src === src) continue;
			existing?.pause();
			const audio = new Audio(src);
			audio.preload = "auto";
			audio.preservesPitch = true;
			audio.dataset.src = src;
			pool.set(scene.id, audio);
		}
		for (const [id, audio] of pool) if (!alive.has(id)) {
			audio.pause();
			pool.delete(id);
		}
	}
	/**
	* 逐帧同步(编辑器预览与导出 HTML 播放器共用)。对齐策略:
	* 只在起播、播放头跳变(拖拽/回跳/循环)、音频时钟连续停走时 seek 对齐;
	* 稳态播放以音频自身时钟为准——按墙钟稳态回拉会在渲染掉帧或变速(rate≠1)时
	* 反复把音频往回拽,听感断续(旧实现 bug)。配音自然播完(ended)后若仍在
	* 场景内保持静默,绝不重启音频管线。
	*/
	function syncSceneAudio(pool, project, t, playing) {
		const spans = sceneSpans(project);
		project.scenes.forEach((scene, i) => {
			const audio = pool.get(scene.id);
			if (!audio) return;
			const local = t - spans[i].start;
			if (playing && local >= 0 && local < sceneDuration(scene)) {
				if (audio.error) return;
				const prev = lastLocal.get(audio);
				lastLocal.set(audio, local);
				if (audio.ended && prev !== void 0 && local >= prev) return;
				if (audio.seeking) return;
				audio.volume = Math.min(1, Math.max(0, scene.audio?.volume ?? 1));
				const rate = scene.audio?.rate ?? 1;
				if (audio.playbackRate !== rate) audio.playbackRate = rate;
				if (audio.paused) {
					if (!starting.has(audio)) {
						starting.add(audio);
						audio.currentTime = Math.max(0, local);
						audio.play().catch(() => void 0).finally(() => starting.delete(audio));
					}
					return;
				}
				const prevAudio = lastBeat.get(audio);
				const nowMs = performance.now();
				lastBeat.set(audio, {
					at: nowMs,
					t: audio.currentTime
				});
				const jumped = prev !== void 0 && Math.abs(local - prev) > .15;
				const stalled = prevAudio !== void 0 && nowMs - prevAudio.at >= 50 && audio.currentTime - prevAudio.t < .001;
				if (jumped || stalled) {
					audio.currentTime = local;
					lastBeat.set(audio, {
						at: nowMs,
						t: local
					});
				}
			} else {
				lastLocal.delete(audio);
				lastBeat.delete(audio);
				starting.delete(audio);
				if (!audio.paused) audio.pause();
			}
		});
	}
	/** 暂停全部配音(pause 对 ended 元素会回卷到起点,循环重进场景可重新起播) */
	function pauseSceneAudio(pool) {
		pool.forEach((audio) => audio.pause());
	}
	//#endregion
	//#region src/core/normalize.ts
	/**
	* 宽容归一化:agent 产出的 JSON 允许缺字段/类型跑偏,这里补默认值、钳边界,
	* 让 watch 模式下的半成品文件也能播放;结构性损坏(根/scenes/elements 形状)才抛错。
	* 契约的权威描述在 docs/schema.md,两者必须同步改。
	*/
	var ANIM_TYPES = /* @__PURE__ */ new Set([
		"pop",
		"fade",
		"riseUp",
		"slideLeft",
		"slideRight",
		"dropDown",
		"wipe",
		"typewriter",
		"zoomIn",
		"spinIn"
	]);
	var EASINGS = /* @__PURE__ */ new Set([
		"linear",
		"easeOut",
		"easeInOut",
		"back"
	]);
	/** 全部合法元素 kind 表:归一化据此跳过未知类型;CLI lint 也用它报「会被静默吞掉」的 kind */
	var ELEMENT_KINDS = {
		title: true,
		artText: true,
		text: true,
		shape: true,
		input: true,
		code: true,
		table: true,
		note: true,
		badge: true,
		arrayCells: true,
		connector: true,
		image: true,
		list: true,
		stepCard: true,
		terminal: true,
		progress: true,
		kbd: true,
		browser: true
	};
	var ProjectParseError = class extends Error {
		constructor(message) {
			super(message);
			this.name = "ProjectParseError";
		}
	};
	function asRecord(v, what) {
		if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ProjectParseError(`${what} 必须是对象`);
		return v;
	}
	function num(v, fallback) {
		return typeof v === "number" && Number.isFinite(v) ? v : fallback;
	}
	function str(v, fallback) {
		return typeof v === "string" && v.length > 0 ? v : fallback;
	}
	function normalizeProject(raw) {
		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new ProjectParseError("项目根必须是 JSON 对象");
		const r = raw;
		if (r.version !== 1) throw new ProjectParseError(`不支持的 version:${String(r.version)};当前协议为 version 1,见 docs/schema.md`);
		if (!Array.isArray(r.scenes)) throw new ProjectParseError("scenes 必须是数组");
		const canvas = typeof r.canvas === "object" && r.canvas !== null ? asRecord(r.canvas, "canvas") : {};
		return {
			version: 1,
			name: str(r.name, "未命名项目"),
			canvas: {
				width: Math.max(1, num(canvas.width, 1920)),
				height: Math.max(1, num(canvas.height, 1080)),
				bg: str(canvas.bg, "#F4F4F1")
			},
			scenes: r.scenes.map((s, i) => normalizeScene(asRecord(s, `scenes[${i}]`), i))
		};
	}
	function normalizeScene(raw, index) {
		if (!Array.isArray(raw.elements)) throw new ProjectParseError(`scenes[${index}].elements 必须是数组`);
		return {
			id: str(raw.id, `sc-${index + 1}`),
			name: str(raw.name, `场景 ${index + 1}`),
			dwell: Math.max(0, num(raw.dwell, 1.5)),
			elements: raw.elements.flatMap((e, j) => {
				if (typeof e !== "object" || e === null) return [];
				const record = e;
				if (typeof record.kind !== "string" || ELEMENT_KINDS[record.kind] !== true) return [];
				return [normalizeElement(record, j)];
			}),
			audio: normalizeSceneAudio(raw.audio)
		};
	}
	/** 配音宽容归一:src 非字符串视为无配音;volume 钳 0-2;rate 钳 0.25-4;duration 仅收正数 */
	function normalizeSceneAudio(raw) {
		if (typeof raw !== "object" || raw === null) return void 0;
		const r = raw;
		if (typeof r.src !== "string" || r.src.length === 0) return void 0;
		const duration = num(r.duration, 0);
		return {
			src: r.src,
			volume: Math.min(2, Math.max(0, num(r.volume, 1))),
			rate: Math.min(4, Math.max(.25, num(r.rate, 1))),
			...duration > 0 ? { duration } : {}
		};
	}
	function normalizeAnim(raw) {
		const type = typeof raw.type === "string" && ANIM_TYPES.has(raw.type) ? raw.type : "fade";
		const easing = typeof raw.easing === "string" && EASINGS.has(raw.easing) ? raw.easing : void 0;
		return {
			type,
			start: Math.max(0, num(raw.start, 0)),
			duration: Math.max(.05, num(raw.duration, .5)),
			...easing ? { easing } : {}
		};
	}
	function normalizeElement(raw, index) {
		const anim = typeof raw.anim === "object" && raw.anim !== null ? asRecord(raw.anim, "anim") : {};
		const base = {
			id: str(raw.id, `el-${index + 1}`),
			x: num(raw.x, 0),
			y: num(raw.y, 0),
			w: Math.max(1, num(raw.w, 200)),
			h: Math.max(1, num(raw.h, 80)),
			anim: normalizeAnim(anim)
		};
		const el = {
			...raw,
			...base
		};
		const connector = el;
		for (const key of ["fromEl", "toEl"]) if (connector[key] !== void 0 && typeof connector[key] !== "string") delete connector[key];
		for (const key of ["fromFocus", "toFocus"]) {
			const f = connector[key];
			if (f === void 0) continue;
			if (!(Array.isArray(f) && f.length === 2 && f.every((n) => typeof n === "number" && Number.isFinite(n)))) delete connector[key];
			else connector[key] = [Math.min(1, Math.max(0, f[0])), Math.min(1, Math.max(0, f[1]))];
		}
		if (el.kind === "shape") {
			if (connector.text !== void 0 && typeof connector.text !== "string") delete connector.text;
			if (connector.sketch !== void 0 && typeof connector.sketch !== "boolean") delete connector.sketch;
			if (connector.sketchSeed !== void 0 && (typeof connector.sketchSeed !== "number" || !Number.isFinite(connector.sketchSeed))) delete connector.sketchSeed;
		}
		if (connector.rotate != null) {
			const deg = Number(connector.rotate);
			if (typeof connector.rotate !== "boolean" && Number.isFinite(deg)) connector.rotate = Math.round(deg * 10) / 10;
			else delete connector.rotate;
		}
		if (connector.route !== void 0 && ![
			"smooth",
			"elbow",
			"straight"
		].includes(String(connector.route))) delete connector.route;
		if (el.kind === "list") {
			const items = el.items;
			if (!Array.isArray(items) || items.some((v) => typeof v !== "string")) el.items = Array.isArray(items) ? items.map((v) => String(v)) : [];
		}
		return el;
	}
	//#endregion
	//#region src/core/render/anim.ts
	function animState(localT, anim) {
		if (localT + 1e-6 < anim.start) return {
			active: false,
			p: 0
		};
		return {
			active: true,
			p: anim.duration <= 0 ? 1 : Math.min(1, (localT - anim.start) / anim.duration)
		};
	}
	var EASING_FNS = {
		linear: (p) => p,
		easeOut: easeOutCubic,
		easeInOut: easeInOutCubic,
		back: easeOutBack
	};
	function resolveEasing(anim) {
		if (anim.easing) return EASING_FNS[anim.easing] ?? easeOutCubic;
		switch (anim.type) {
			case "typewriter": return EASING_FNS.linear;
			case "pop":
			case "spinIn":
			case "dropDown": return EASING_FNS.back;
			default: return EASING_FNS.easeOut;
		}
	}
	/**
	* 动画 -> 视觉参数。约定:typewriter 只对文本类元素生效(字符级裁剪在绘制内部),
	* 对非文本元素回落为快速淡入;wipe/dx/dy/scale/rotation 全部由缓动后的 e 驱动。
	*/
	function animVisual(anim, p) {
		const e = resolveEasing(anim)(p);
		switch (anim.type) {
			case "fade": return {
				alpha: e,
				dx: 0,
				dy: 0,
				rotation: 0,
				scale: 1,
				wipeWidth: null
			};
			case "pop": return {
				alpha: Math.min(1, p * 2.5),
				dx: 0,
				dy: 0,
				rotation: 0,
				scale: .6 + .4 * e,
				wipeWidth: null
			};
			case "riseUp": return {
				alpha: e,
				dx: 0,
				dy: (1 - e) * 46,
				rotation: 0,
				scale: 1,
				wipeWidth: null
			};
			case "slideLeft": return {
				alpha: e,
				dx: -(1 - e) * 320,
				dy: 0,
				rotation: 0,
				scale: 1,
				wipeWidth: null
			};
			case "slideRight": return {
				alpha: e,
				dx: (1 - e) * 320,
				dy: 0,
				rotation: 0,
				scale: 1,
				wipeWidth: null
			};
			case "dropDown": return {
				alpha: e,
				dx: 0,
				dy: -(1 - e) * 160,
				rotation: 0,
				scale: 1,
				wipeWidth: null
			};
			case "zoomIn": return {
				alpha: e,
				dx: 0,
				dy: 0,
				rotation: 0,
				scale: .82 + .18 * e,
				wipeWidth: null
			};
			case "spinIn": return {
				alpha: e,
				dx: 0,
				dy: 0,
				rotation: -(1 - e) * 1.8,
				scale: .7 + .3 * e,
				wipeWidth: null
			};
			case "wipe": return {
				alpha: 1,
				dx: 0,
				dy: 0,
				rotation: 0,
				scale: 1,
				wipeWidth: e
			};
			case "typewriter": return {
				alpha: Math.min(1, p * 3),
				dx: 0,
				dy: 0,
				rotation: 0,
				scale: 1,
				wipeWidth: null,
				progress: p
			};
		}
	}
	//#endregion
	//#region src/core/highlight.ts
	/** 按高亮短语切分文本;多个短语互不重叠,游标从左往右,同位置取最长命中 */
	function splitRuns(text, highlights) {
		if (!text) return [];
		if (!highlights || highlights.length === 0) return [{
			text,
			hl: false
		}];
		const ranges = [];
		let cursor = 0;
		while (cursor < text.length) {
			let best = null;
			for (const h of highlights) {
				if (!h) continue;
				const at = text.indexOf(h, cursor);
				if (at < 0) continue;
				if (!best || at < best[0] || at === best[0] && h.length > best[1] - best[0]) best = [at, at + h.length];
			}
			if (!best) break;
			ranges.push(best);
			cursor = best[1];
		}
		const runs = [];
		let pos = 0;
		for (const [start, end] of ranges) {
			if (start > pos) runs.push({
				text: text.slice(pos, start),
				hl: false
			});
			runs.push({
				text: text.slice(start, end),
				hl: true
			});
			pos = end;
		}
		if (pos < text.length) runs.push({
			text: text.slice(pos),
			hl: false
		});
		return runs.filter((run) => run.text.length > 0);
	}
	function isWideChar(ch) {
		return (ch.codePointAt(0) ?? 0) > 11903;
	}
	/** 原子化:CJK 单字成原子、连续字母数字成词、空白与其余符号各自成原子;保留高亮标记 */
	function atomsOf(text, highlights) {
		const atoms = [];
		for (const run of splitRuns(text, highlights)) {
			let buf = "";
			const flush = () => {
				if (buf) {
					atoms.push({
						text: buf,
						hl: run.hl
					});
					buf = "";
				}
			};
			for (const ch of run.text) if (isWideChar(ch)) {
				flush();
				atoms.push({
					text: ch,
					hl: run.hl
				});
			} else if (/[A-Za-z0-9]/.test(ch)) buf += ch;
			else {
				flush();
				atoms.push({
					text: ch,
					hl: run.hl
				});
			}
			flush();
		}
		return atoms;
	}
	//#endregion
	//#region src/core/wrap.ts
	function wrapAtoms(atoms, maxWidth, measure) {
		const lines = [];
		let current = [];
		let width = 0;
		const push = () => {
			if (current.length === 0) return;
			lines.push({
				atoms: current,
				width
			});
			current = [];
			width = 0;
		};
		for (const atom of atoms) {
			const w = measure(atom);
			if (current.length > 0 && width + w > maxWidth) {
				if (current[current.length - 1].text === " ") {
					width -= measure(current[current.length - 1]);
					current.pop();
				}
				push();
				if (atom.text === " ") continue;
			}
			current.push(atom);
			width += w;
		}
		push();
		return lines;
	}
	//#endregion
	//#region src/core/render/text.ts
	/** 文本类元素的富文本绘制:高亮短语 = 黑底白字圆角芯片,支持居中/左对齐与打字机裁剪。 */
	var SANS = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif`;
	var MONO = `"SF Mono",Menlo,Consolas,"Liberation Mono",monospace`;
	function sansFont(size, weight = 600) {
		return `${weight} ${size}px ${SANS}`;
	}
	function monoFont(size, weight = 500) {
		return `${weight} ${size}px ${MONO}`;
	}
	function roundRect(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, r);
	}
	function drawRichText(ctx, x, y, w, h, text, opts) {
		const atoms = atomsOf(text, opts.highlights);
		const visible = opts.progress === void 0 ? atoms : atoms.slice(0, Math.ceil(opts.progress * atoms.length));
		if (visible.length === 0) return;
		ctx.save();
		ctx.font = sansFont(opts.fontSize, 600);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		const chipPadX = opts.fontSize * .18;
		const chipGap = opts.fontSize * .06;
		const measure = (atom) => ctx.measureText(atom.text).width + (atom.hl ? chipPadX * 2 + chipGap : 0);
		const lineHeight = opts.fontSize * 1.5;
		const lines = wrapAtoms(visible, w, measure);
		const chipH = opts.fontSize * 1.3;
		let ly = y + (h - lines.length * lineHeight) / 2 + lineHeight / 2;
		for (const line of lines) {
			let lx = opts.align === "center" ? x + (w - line.width) / 2 : x;
			for (const atom of line.atoms) {
				const textW = ctx.measureText(atom.text).width;
				if (atom.hl) {
					roundRect(ctx, lx, ly - chipH / 2, textW + chipPadX * 2, chipH, chipH * .24);
					ctx.fillStyle = "#1F2937";
					ctx.fill();
					ctx.fillStyle = "#F9FAFB";
					ctx.fillText(atom.text, lx + chipPadX, ly + 1);
					lx += textW + chipPadX * 2 + chipGap;
				} else {
					if (opts.stroke && opts.stroke.width > 0) {
						ctx.lineJoin = "round";
						ctx.strokeStyle = opts.stroke.color;
						ctx.lineWidth = opts.stroke.width;
						ctx.strokeText(atom.text, lx, ly);
					}
					ctx.fillStyle = opts.color;
					ctx.fillText(atom.text, lx, ly);
					lx += textW;
				}
			}
			ly += lineHeight;
		}
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/code.ts
	/** 代码块:mac 三点标题栏 + 轻量词法着色(注释/字符串/数字/关键词),语言无关。 */
	var KEYWORDS = /* @__PURE__ */ new Set([
		"function",
		"return",
		"const",
		"let",
		"var",
		"if",
		"else",
		"for",
		"while",
		"break",
		"continue",
		"class",
		"new",
		"this",
		"import",
		"from",
		"export",
		"default",
		"async",
		"await",
		"typeof",
		"interface",
		"type",
		"extends",
		"implements",
		"def",
		"lambda",
		"pass",
		"print",
		"fn",
		"pub",
		"use",
		"mut",
		"match",
		"struct",
		"impl",
		"enum",
		"true",
		"false",
		"null",
		"undefined",
		"nil",
		"console",
		"log",
		"print"
	]);
	var TOKEN_RE = /(\/\/.*|#.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
	function tokenizeLine(line) {
		const tokens = [];
		TOKEN_RE.lastIndex = 0;
		for (let m = TOKEN_RE.exec(line); m !== null; m = TOKEN_RE.exec(line)) {
			const [full, comment, str, numLit, word, space] = m;
			let color = "#334155";
			if (comment) color = "#94A3B8";
			else if (str) color = "#059669";
			else if (numLit) color = "#2563EB";
			else if (word) color = KEYWORDS.has(word) ? "#7C3AED" : "#334155";
			else if (!space) color = "#64748B";
			tokens.push({
				text: full,
				color
			});
		}
		return tokens;
	}
	/** mac 窗口三个圆点(代码块/终端/浏览器共用),x/y 为首圆点圆心 */
	function drawWindowDots(ctx, x, y, r) {
		[
			"#FF5F57",
			"#FEBC2E",
			"#28C840"
		].forEach((color, i) => {
			ctx.beginPath();
			ctx.arc(x + i * r * 3.4, y, r, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		});
	}
	function drawCode(ctx, el, progress) {
		const fontSize = el.fontSize ?? 26;
		const lineH = fontSize * 1.6;
		const headerH = fontSize * 2.1;
		const padX = fontSize * .9;
		const bg = el.dark ? "#0F172A" : "#FFFFFF";
		const border = el.dark ? "#1E293B" : "#E2E8F0";
		const defaultColor = el.dark ? "#E2E8F0" : "#334155";
		const commentColor = el.dark ? "#64748B" : "#94A3B8";
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 16);
		ctx.clip();
		ctx.fillStyle = bg;
		ctx.fill();
		const dotR = fontSize * .22;
		const dotY = el.y + headerH / 2;
		drawWindowDots(ctx, el.x + fontSize, dotY, dotR);
		if (el.filename) {
			ctx.font = sansFont(fontSize * .82, 500);
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillStyle = el.dark ? "#94A3B8" : "#64748B";
			ctx.fillText(el.filename, el.x + fontSize + dotR * 3.4 * 3 + 12, dotY);
		}
		ctx.strokeStyle = border;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(el.x, el.y + headerH);
		ctx.lineTo(el.x + el.w, el.y + headerH);
		ctx.stroke();
		ctx.font = monoFont(fontSize);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		const lines = el.code.split("\n");
		const shownCount = progress === void 0 ? lines.length : Math.max(1, Math.ceil(progress * lines.length));
		let ly = el.y + headerH + lineH * .7;
		for (let i = 0; i < Math.min(shownCount, lines.length); i++) {
			let lx = el.x + padX;
			for (const token of tokenizeLine(lines[i])) {
				ctx.fillStyle = token.color === "#94A3B8" ? commentColor : el.dark && token.color === "#334155" ? defaultColor : token.color;
				ctx.fillText(token.text, lx, ly);
				lx += ctx.measureText(token.text).width;
			}
			ly += lineH;
		}
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/cards.ts
	/** 卡片与窗口绘制:步骤卡片 / 终端窗口 / 浏览器窗口。 */
	function drawStepCard(ctx, el, progress) {
		const fontSize = el.fontSize ?? 34;
		const pad = fontSize * .9;
		const chip = fontSize * 1.7;
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 20);
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = "#E2E8F0";
		ctx.lineWidth = 2;
		ctx.stroke();
		const accent = el.accent ?? "#3B82F6";
		const chipX = el.x + pad;
		const chipY = el.y + pad;
		roundRect(ctx, chipX, chipY, chip, chip, chip * .28);
		ctx.fillStyle = accent;
		ctx.fill();
		ctx.font = sansFont(fontSize, 700);
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#FFFFFF";
		ctx.fillText(el.num ?? "1", chipX + chip / 2, chipY + chip / 2 + 1);
		if (el.title) {
			ctx.textAlign = "left";
			ctx.fillStyle = "#111827";
			ctx.font = sansFont(fontSize, 700);
			ctx.fillText(el.title, chipX + chip + fontSize * .55, chipY + chip / 2 + 1);
		}
		if (el.desc) drawRichText(ctx, el.x + pad, chipY + chip + fontSize * .55, el.w - pad * 2, Math.max(el.h - pad - chip - fontSize * .55, fontSize * 1.5), el.desc, {
			fontSize: fontSize * .82,
			color: "#475569",
			align: "left",
			highlights: el.highlight,
			progress
		});
		ctx.restore();
	}
	function drawTerminal(ctx, el, progress) {
		const fontSize = el.fontSize ?? 26;
		const dark = el.dark !== false;
		const lineH = fontSize * 1.6;
		const headerH = fontSize * 2.1;
		const padX = fontSize * .9;
		const bg = dark ? "#0F172A" : "#FFFFFF";
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 16);
		ctx.clip();
		ctx.fillStyle = bg;
		ctx.fill();
		const dotR = fontSize * .22;
		drawWindowDots(ctx, el.x + fontSize, el.y + headerH / 2, dotR);
		ctx.font = sansFont(fontSize * .82, 500);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = dark ? "#94A3B8" : "#64748B";
		ctx.fillText(el.title ?? "zsh", el.x + fontSize + dotR * 3.4 * 3 + 12, el.y + headerH / 2);
		ctx.strokeStyle = dark ? "#1E293B" : "#E2E8F0";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(el.x, el.y + headerH);
		ctx.lineTo(el.x + el.w, el.y + headerH);
		ctx.stroke();
		ctx.font = monoFont(fontSize);
		const lines = el.code.split("\n");
		const shown = progress === void 0 ? lines.length : Math.max(1, Math.ceil(progress * lines.length));
		const promptColor = dark ? "#34D399" : "#059669";
		let ly = el.y + headerH + lineH * .7;
		for (let i = 0; i < Math.min(shown, lines.length); i++) {
			const line = lines[i];
			if (line.startsWith("$")) {
				ctx.fillStyle = promptColor;
				ctx.fillText("$", el.x + padX, ly);
				const promptW = ctx.measureText("$").width;
				ctx.fillStyle = dark ? "#E2E8F0" : "#0F172A";
				ctx.fillText(line.slice(1), el.x + padX + promptW, ly);
			} else {
				ctx.fillStyle = dark ? "#94A3B8" : "#64748B";
				ctx.fillText(line, el.x + padX, ly);
			}
			ly += lineH;
		}
		ctx.restore();
	}
	function drawBrowser(ctx, el) {
		const fontSize = el.fontSize ?? 26;
		const headerH = fontSize * 2.2;
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 16);
		ctx.fillStyle = el.body ?? "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = "#E2E8F0";
		ctx.lineWidth = 2;
		ctx.stroke();
		const dotR = fontSize * .22;
		const dotX = el.x + fontSize * .9;
		drawWindowDots(ctx, dotX, el.y + headerH / 2, dotR);
		const pillX = dotX + dotR * 3.4 * 3;
		const pillW = Math.max(el.w - (pillX - el.x) - fontSize * .9, fontSize * 4);
		const pillH = fontSize * 1.35;
		roundRect(ctx, pillX, el.y + (headerH - pillH) / 2, pillW, pillH, pillH / 2);
		ctx.fillStyle = "#F1F5F9";
		ctx.fill();
		if (el.url) {
			ctx.font = sansFont(fontSize * .82, 500);
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "#64748B";
			ctx.fillText(el.url, pillX + fontSize * .6, el.y + headerH / 2 + 1);
		}
		ctx.strokeStyle = "#E2E8F0";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(el.x, el.y + headerH);
		ctx.lineTo(el.x + el.w, el.y + headerH);
		ctx.stroke();
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/cells.ts
	/** 色块数组(视频里的 token/字节格):从 (x,y) 起按 perRow 折行,粉彩色板兜底。 */
	/** 粉彩色板兜底,行内编辑浮层与属性面板共用同一套底色 */
	var PALETTE = [
		"#DBEAFE",
		"#DCFCE7",
		"#FEF9C3",
		"#FCE7F3",
		"#E0E7FF",
		"#CCFBF1"
	];
	function drawArrayCells(ctx, el) {
		const size = el.cellSize ?? 88;
		const gap = el.gap ?? 14;
		const perRow = Math.max(1, el.perRow ?? el.cells.length);
		const fontSize = el.fontSize ?? size * .5;
		ctx.save();
		ctx.font = sansFont(fontSize, 600);
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		el.cells.forEach((cell, i) => {
			const cx = el.x + i % perRow * (size + gap);
			const cy = el.y + Math.floor(i / perRow) * (size + gap);
			roundRect(ctx, cx, cy, size, size, size * .18);
			ctx.fillStyle = el.colors?.[i] ?? PALETTE[i % PALETTE.length];
			ctx.fill();
			ctx.fillStyle = "#1E293B";
			ctx.fillText(cell, cx + size / 2, cy + size / 2 + 1);
		});
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/shapeGeo.ts
	/**
	* 形状几何:把 shape 变体描成路径(可能含多个子路径,如圆柱顶面、对话框尾巴),
	* 填充/描边由调用方统一处理;圆柱顶面与对话框尾巴重叠填充无副作用(nonzero)。
	*/
	function polygon(ctx, points) {
		ctx.moveTo(points[0][0], points[0][1]);
		for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
		ctx.closePath();
	}
	/** 五角星顶点:外接 (w x h) 椭圆,内半径比例 0.42,顶点朝上 */
	function starPoints(x, y, w, h) {
		const cx = x + w / 2;
		const cy = y + h / 2;
		const rx = w / 2;
		const ry = h / 2;
		const points = [];
		for (let i = 0; i < 10; i++) {
			const angle = -Math.PI / 2 + i * Math.PI / 5;
			const f = i % 2 === 0 ? 1 : .42;
			points.push([cx + Math.cos(angle) * rx * f, cy + Math.sin(angle) * ry * f]);
		}
		return points;
	}
	/** FNV-1a 字符串哈希 → 稳定种子;同 id 每次渲染抖出同一形状,保证 (project,t) 纯函数 */
	function hashSeed(id) {
		let h = 2166136261;
		for (let i = 0; i < id.length; i++) h = (h ^ id.charCodeAt(i)) * 16777619;
		return h >>> 0;
	}
	/** 种子噪声 [0,1),sin 哈希,够用的确定性伪随机 */
	function noise(seed, i) {
		const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
		return v - Math.floor(v);
	}
	/** 逐顶点抖动:幅度 ~ min(w,h)*5%,有界 1.5~10 逻辑像素;salt 让同一元素的子路径抖得不同。
	*  种子优先取 sketchSeed(点击/粘贴时随机生成),缺省按 id 稳定展开——渲染仍是纯函数 */
	function wobble(el, pts, salt = 0) {
		const amp = Math.min(10, Math.max(1.5, Math.min(el.w, el.h) * 5 / 100));
		const seed = Math.round(el.sketchSeed ?? hashSeed(el.id)) + salt;
		return pts.map(([px, py], i) => [px + (noise(seed, i * 2) - .5) * 2 * amp, py + (noise(seed, i * 2 + 1) - .5) * 2 * amp]);
	}
	/** 椭圆/圆弧采样点(角度 from..to 均分 n 段) */
	function arcPoints(cx, cy, rx, ry, from, to, n) {
		const pts = [];
		for (let i = 0; i <= n; i++) {
			const a = from + (to - from) * i / n;
			pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
		}
		return pts;
	}
	/** 圆角矩形周长采样:四边中点 + 每角 3 段圆弧 */
	function rectPoints(x, y, w, h, r) {
		const rr = Math.min(r, w / 2, h / 2);
		const pts = [];
		const corner = (cx, cy, from) => {
			for (let i = 0; i <= 3; i++) {
				const a = from + i / 3 * (Math.PI / 2);
				pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
			}
		};
		pts.push([x + rr, y], [x + w - rr, y]);
		corner(x + w - rr, y + rr, -Math.PI / 2);
		pts.push([x + w, y + h - rr]);
		corner(x + w - rr, y + h - rr, 0);
		pts.push([x + w - rr, y + h], [x + rr, y + h]);
		corner(x + rr, y + h - rr, Math.PI / 2);
		pts.push([x, y + rr]);
		corner(x + rr, y + rr, Math.PI);
		return pts;
	}
	/** 手绘描迹:各变体展开为点列后抖动;圆柱顶面/对话框尾巴用 salt 区分子路径 */
	function traceSketch(ctx, el) {
		const { x, y, w, h } = el;
		const poly = (pts, salt = 0) => polygon(ctx, wobble(el, pts, salt));
		ctx.beginPath();
		switch (el.shape) {
			case "ellipse":
				poly(arcPoints(x + w / 2, y + h / 2, w / 2, h / 2, 0, Math.PI * 2, 14));
				break;
			case "triangle":
				poly([
					[x + w / 2, y],
					[x + w, y + h],
					[x, y + h]
				]);
				break;
			case "diamond":
				poly([
					[x + w / 2, y],
					[x + w, y + h / 2],
					[x + w / 2, y + h],
					[x, y + h / 2]
				]);
				break;
			case "hexagon":
				poly([
					[x, y + h / 2],
					[x + w * .25, y],
					[x + w * .75, y],
					[x + w, y + h / 2],
					[x + w * .75, y + h],
					[x + w * .25, y + h]
				]);
				break;
			case "star":
				poly(starPoints(x, y, w, h));
				break;
			case "cylinder": {
				const rx = w / 2;
				const ry = Math.min(h * .14, h / 4);
				const cx = x + rx;
				poly([
					[x, y + ry],
					[x, y + h - ry],
					...arcPoints(cx, y + h - ry, rx, ry, Math.PI, Math.PI * 2, 7),
					[x + w, y + ry],
					...arcPoints(cx, y + ry, rx, ry, 0, -Math.PI, 7)
				]);
				poly(arcPoints(cx, y + ry, rx, ry, 0, Math.PI * 2, 12), 31);
				break;
			}
			case "blockArrow": {
				const cy = y + h / 2;
				const shaft = h * .45;
				const headLen = Math.min(w * .38, w / 2);
				poly([
					[x, cy - shaft / 2],
					[x + w - headLen, cy - shaft / 2],
					[x + w - headLen, y],
					[x + w, cy],
					[x + w - headLen, y + h],
					[x + w - headLen, cy + shaft / 2],
					[x, cy + shaft / 2]
				]);
				break;
			}
			case "speechBubble": {
				const bodyH = h * .76;
				poly(rectPoints(x, y, w, bodyH, Math.min(18, h / 4)));
				poly([
					[x + w * .2, y + bodyH - 2],
					[x + w * .14, y + h],
					[x + w * .4, y + bodyH - 2]
				], 7);
				break;
			}
			default: poly(rectPoints(x, y, w, h, Math.min(el.radius ?? 0, Math.min(w, h) / 2)));
		}
	}
	function traceShape(ctx, el) {
		if (el.sketch) {
			traceSketch(ctx, el);
			return;
		}
		const { x, y, w, h } = el;
		ctx.beginPath();
		switch (el.shape) {
			case "ellipse":
				ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
				break;
			case "triangle":
				polygon(ctx, [
					[x + w / 2, y],
					[x + w, y + h],
					[x, y + h]
				]);
				break;
			case "diamond":
				polygon(ctx, [
					[x + w / 2, y],
					[x + w, y + h / 2],
					[x + w / 2, y + h],
					[x, y + h / 2]
				]);
				break;
			case "hexagon":
				polygon(ctx, [
					[x, y + h / 2],
					[x + w * .25, y],
					[x + w * .75, y],
					[x + w, y + h / 2],
					[x + w * .75, y + h],
					[x + w * .25, y + h]
				]);
				break;
			case "star":
				polygon(ctx, starPoints(x, y, w, h));
				break;
			case "cylinder": {
				const rx = w / 2;
				const ry = Math.min(h * .14, h / 4);
				const cx = x + rx;
				ctx.moveTo(x, y + ry);
				ctx.lineTo(x, y + h - ry);
				ctx.ellipse(cx, y + h - ry, rx, ry, 0, Math.PI, 0, true);
				ctx.lineTo(x + w, y + ry);
				ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI, true);
				ctx.closePath();
				ctx.moveTo(x + w, y + ry);
				ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2);
				break;
			}
			case "blockArrow": {
				const cy = y + h / 2;
				const shaft = h * .45;
				const headLen = Math.min(w * .38, w / 2);
				polygon(ctx, [
					[x, cy - shaft / 2],
					[x + w - headLen, cy - shaft / 2],
					[x + w - headLen, y],
					[x + w, cy],
					[x + w - headLen, y + h],
					[x + w - headLen, cy + shaft / 2],
					[x, cy + shaft / 2]
				]);
				break;
			}
			case "speechBubble": {
				const bodyH = h * .76;
				ctx.roundRect(x, y, w, bodyH, Math.min(18, h / 4));
				polygon(ctx, [
					[x + w * .2, y + bodyH - 2],
					[x + w * .14, y + h],
					[x + w * .4, y + bodyH - 2]
				]);
				break;
			}
			default: ctx.roundRect(x, y, w, h, Math.min(el.radius ?? 0, Math.min(w, h) / 2));
		}
	}
	//#endregion
	//#region src/core/render/elements.ts
	/** 文本类元素绘制:标题 / 艺术字 / 正文 / 输入框 / 便签 / 徽章 / 形状。 */
	/** 按填充亮度反推可读文字色(亮色底用深字,暗色底用白字);形状绘制与行内编辑共用 */
	function readableOn(fill) {
		const m = /^#?([0-9a-f]{6})$/i.exec(fill ?? "");
		if (!m) return "#1F2937";
		const n = parseInt(m[1], 16);
		return .299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255) > 150 ? "#1F2937" : "#FFFFFF";
	}
	function drawShape(ctx, el) {
		traceShape(ctx, el);
		const hasStroke = Boolean(el.stroke) && (el.strokeWidth ?? 0) > 0;
		if (el.fill) {
			ctx.fillStyle = el.fill;
			ctx.fill();
		} else if (!hasStroke) {
			ctx.fillStyle = "rgba(100,116,139,0.18)";
			ctx.fill();
		}
		if (hasStroke) {
			ctx.strokeStyle = el.stroke;
			ctx.lineWidth = el.strokeWidth ?? 0;
			ctx.stroke();
			if (el.sketch) {
				ctx.globalAlpha = .55;
				ctx.lineWidth = (el.strokeWidth ?? 0) * .55;
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
		}
		if (el.text) drawRichText(ctx, el.x, el.y, el.w, el.h, el.text, {
			fontSize: el.fontSize ?? 28,
			color: el.color ?? readableOn(el.fill),
			align: "center"
		});
	}
	function drawTitle(ctx, el, progress) {
		drawRichText(ctx, el.x, el.y, el.w, el.h, el.text, {
			fontSize: el.fontSize ?? 64,
			color: el.color ?? "#111827",
			align: "center",
			highlights: el.highlight,
			progress
		});
	}
	function drawArtText(ctx, el, progress) {
		const fontSize = el.fontSize ?? 96;
		drawRichText(ctx, el.x, el.y, el.w, el.h, el.text, {
			fontSize,
			color: el.color ?? "#F59E0B",
			align: "center",
			progress,
			stroke: {
				color: el.stroke ?? "#111827",
				width: Math.max(2, fontSize * .09)
			}
		});
	}
	function drawText(ctx, el, progress) {
		drawRichText(ctx, el.x, el.y, el.w, el.h, el.text, {
			fontSize: el.fontSize ?? 40,
			color: el.color ?? "#1F2937",
			align: el.align ?? "left",
			highlights: el.highlight,
			progress
		});
	}
	function drawInput(ctx, el) {
		const fontSize = el.fontSize ?? 34;
		roundRect(ctx, el.x, el.y, el.w, el.h, 12);
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = "#94A3B8";
		ctx.lineWidth = 2.5;
		ctx.stroke();
		ctx.font = sansFont(fontSize, 500);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#111827";
		const padX = fontSize * .6;
		ctx.fillText(el.text, el.x + padX, el.y + el.h / 2 + 1);
		const textW = ctx.measureText(el.text).width;
		ctx.fillRect(el.x + padX + textW + 8, el.y + el.h * .28, 3, el.h * .44);
	}
	function drawNote(ctx, el, progress) {
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 10);
		ctx.fillStyle = el.bg ?? "#FDE68A";
		ctx.fill();
		ctx.strokeStyle = "rgba(0,0,0,0.08)";
		ctx.lineWidth = 2;
		ctx.stroke();
		drawRichText(ctx, el.x + 18, el.y + 14, el.w - 36, el.h - 28, el.text, {
			fontSize: el.fontSize ?? 30,
			color: "#78350F",
			align: "center",
			progress
		});
		ctx.restore();
	}
	function drawBadge(ctx, el) {
		const fontSize = el.fontSize ?? 34;
		ctx.save();
		ctx.font = sansFont(fontSize, 600);
		const textW = ctx.measureText(el.text).width;
		const padX = fontSize * .7;
		const w = Math.max(el.w, textW + padX * 2);
		roundRect(ctx, el.x, el.y, w, el.h, el.h / 2);
		ctx.fillStyle = el.bg ?? "#1D4ED8";
		ctx.fill();
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = el.color ?? "#FFFFFF";
		ctx.fillText(el.text, el.x + (w - textW) / 2, el.y + el.h / 2 + 1);
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/connectorRoute.ts
	/** 位移主轴的正交方向(Excalidraw vectorToHeading) */
	function vectorToHeading(vx, vy) {
		const absX = Math.abs(vx);
		const absY = Math.abs(vy);
		if (vx > absY) return [1, 0];
		if (vx <= -absY) return [-1, 0];
		if (vy > absX) return [0, 1];
		return [0, -1];
	}
	/** 绑定元素出口方向:元素中心四象限主轴判定(Excalidraw headingForPointFromElement 的搜索锥等价于中心射线分象限,对任意距离成立) */
	function headingForPointFromElement(rect, p) {
		return vectorToHeading(p.x - (rect.x + rect.w / 2), p.y - (rect.y + rect.h / 2));
	}
	function connectorHeadings(el, elements) {
		const boundsOf = (id) => {
			if (!id) return null;
			const target = elements.find((e) => e.id === id);
			return target ? elementBounds(target) : null;
		};
		const [x1, y1] = el.from;
		const [x2, y2] = el.to;
		const bFrom = boundsOf(el.fromEl);
		const bTo = boundsOf(el.toEl);
		return [bFrom ? headingForPointFromElement(bFrom, {
			x: x2,
			y: y2
		}) : vectorToHeading(x2 - x1, y2 - y1), bTo ? headingForPointFromElement(bTo, {
			x: x1,
			y: y1
		}) : vectorToHeading(x1 - x2, y1 - y2)];
	}
	var add = (p, h, d) => ({
		x: p.x + h[0] * d,
		y: p.y + h[1] * d
	});
	/** 无障碍情形的正交路由:出口段 → 连接段 → 入口段(语义对齐 Excalidraw elbow 常规输出) */
	function routeElbow(from, to, h1, h2, stub = 40) {
		const proj1 = (to.x - from.x) * h1[0] + (to.y - from.y) * h1[1];
		const proj2 = (from.x - to.x) * h2[0] + (from.y - to.y) * h2[1];
		const d1 = Math.min(stub, Math.max(0, proj1));
		const d2 = Math.min(stub, Math.max(0, proj2));
		const a = add(from, h1, d1);
		const b = add(to, h2, d2);
		const mids = [];
		if (h1[0] !== 0 && h2[1] !== 0) mids.push({
			x: b.x,
			y: a.y
		});
		else if (h1[1] !== 0 && h2[0] !== 0) mids.push({
			x: a.x,
			y: b.y
		});
		else if (h1[0] !== 0 && h2[0] !== 0) {
			const mx = (a.x + b.x) / 2;
			mids.push({
				x: mx,
				y: a.y
			}, {
				x: mx,
				y: b.y
			});
		} else {
			const my = (a.y + b.y) / 2;
			mids.push({
				x: a.x,
				y: my
			}, {
				x: b.x,
				y: my
			});
		}
		const raw = [
			from,
			a,
			...mids,
			b,
			to
		];
		const out = [];
		for (const p of raw) {
			const last = out[out.length - 1];
			if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1) out.push(p);
		}
		return out.filter((p, i) => {
			if (i === 0 || i === out.length - 1) return true;
			const prev = out[i - 1];
			const next = out[i + 1];
			return !(prev.x === p.x && p.x === next.x || prev.y === p.y && p.y === next.y);
		});
	}
	/** 折线路径(直角拐角圆滑:corner = min(radius, 半段长),语义对齐 generateElbowArrowShape);scale 供画布→屏幕换算 */
	function strokeRoundedPolyline(ctx, pts, to, scale = 1, radius = 16) {
		ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
		for (let i = 1; i < pts.length - 1; i++) {
			const prev = pts[i - 1];
			const cur = pts[i];
			const next = pts[i + 1];
			const r = Math.min(radius, Math.hypot(cur.x - prev.x, cur.y - prev.y) / 2, Math.hypot(next.x - cur.x, next.y - cur.y) / 2) * scale;
			ctx.arcTo(cur.x * scale, cur.y * scale, next.x * scale, next.y * scale, r);
		}
		ctx.lineTo(to.x * scale, to.y * scale);
	}
	/** 障碍 = 除两端绑定元素外的全部非连线元素包围盒,外扩 pad(线至少离元素 pad 像素) */
	function obstacleRects(el, elements, pad) {
		const out = [];
		for (const e of elements) {
			if (e.id === el.fromEl || e.id === el.toEl || e.kind === "connector") continue;
			const b = elementBounds(e);
			if (b) out.push({
				x: b.x - pad,
				y: b.y - pad,
				w: b.w + pad * 2,
				h: b.h + pad * 2
			});
		}
		return out;
	}
	/** 点是否严格落在(已外扩的)障碍内;贴边不算,保证线离真实元素 ≥ pad */
	function inObstacle(r, px, py) {
		return px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h;
	}
	/** 折线是否穿过任何障碍(逐段按 4px 步长采样) */
	function pathClear(pts, obstacles) {
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1];
			const b = pts[i];
			const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
			for (let s = 0; s <= steps; s++) {
				const x = a.x + (b.x - a.x) * s / steps;
				const y = a.y + (b.y - a.y) * s / steps;
				for (const r of obstacles) if (inObstacle(r, x, y)) return false;
			}
		}
		return true;
	}
	function dedupePolyline(pts) {
		const out = [];
		for (const p of pts) {
			const last = out[out.length - 1];
			if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1) out.push(p);
		}
		return out.filter((p, i) => {
			if (i === 0 || i === out.length - 1) return true;
			const prev = out[i - 1];
			const next = out[i + 1];
			return !(prev.x === p.x && p.x === next.x || prev.y === p.y && p.y === next.y);
		});
	}
	var polylineLen = (pts) => {
		let len = 0;
		for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
		return len;
	};
	/**
	* 障碍感知的直角路由:先走无障碍 elbow;被挡则枚举中段重排方案——
	* 两种 L 拐角 + 以障碍边缘/中点为 lane 的 Z 折线,取第一条不穿障的最短路径;
	* 全部被挡时回落原 elbow(极端密布局不硬绕)。
	*/
	function routeElbowAvoid(from, to, h1, h2, obstacles, stub = 40) {
		const base = routeElbow(from, to, h1, h2, stub);
		if (!obstacles.length || pathClear(base, obstacles)) return base;
		const proj1 = (to.x - from.x) * h1[0] + (to.y - from.y) * h1[1];
		const proj2 = (from.x - to.x) * h2[0] + (from.y - to.y) * h2[1];
		const a = add(from, h1, Math.min(stub, Math.max(0, proj1)));
		const b = add(to, h2, Math.min(stub, Math.max(0, proj2)));
		const mids = [];
		if (a.x !== b.x && a.y !== b.y) mids.push([
			a,
			{
				x: b.x,
				y: a.y
			},
			b
		], [
			a,
			{
				x: a.x,
				y: b.y
			},
			b
		]);
		else mids.push([a, b]);
		const lanes = /* @__PURE__ */ new Set();
		for (const r of obstacles) lanes.add(r.x - 1).add(r.x + r.w + 1).add(r.y - 1).add(r.y + r.h + 1);
		for (const lane of lanes) {
			if (a.x !== b.x) mids.push([
				a,
				{
					x: lane,
					y: a.y
				},
				{
					x: lane,
					y: b.y
				},
				b
			]);
			if (a.y !== b.y) mids.push([
				a,
				{
					x: a.x,
					y: lane
				},
				{
					x: b.x,
					y: lane
				},
				b
			]);
		}
		let best = null;
		let bestLen = Infinity;
		for (const mid of mids) {
			const pts = dedupePolyline([
				from,
				...mid,
				to
			]);
			if (!pathClear(pts, obstacles)) continue;
			const len = polylineLen(pts);
			if (len < bestLen) {
				best = pts;
				bestLen = len;
			}
		}
		return best ?? base;
	}
	function polylineRoute(points) {
		let total = 0;
		const segs = [];
		for (let i = 1; i < points.length; i++) {
			const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
			segs.push([
				points[i - 1],
				points[i],
				d
			]);
			total += d;
		}
		const at = (t) => {
			let remain = total * t;
			for (const [a, b, d] of segs) {
				if (remain <= d || d === 0) {
					const r = d === 0 ? 0 : remain / d;
					return {
						x: a.x + (b.x - a.x) * r,
						y: a.y + (b.y - a.y) * r
					};
				}
				remain -= d;
			}
			return points[points.length - 1];
		};
		const last = segs[segs.length - 1];
		return {
			mode: "segments",
			points,
			mid: at(.5),
			endAngle: Math.atan2(last[1].y - last[0].y, last[1].x - last[0].x),
			sample: (step = 8) => {
				const count = Math.max(8, Math.ceil(total / step));
				return Array.from({ length: count + 1 }, (_, i) => at(i / count));
			}
		};
	}
	function curveRoute(el) {
		const geo = connectorGeometry(el);
		const dist = Math.hypot(el.to[0] - el.from[0], el.to[1] - el.from[1]);
		return {
			mode: geo.auto ? "cubic" : "quad",
			points: [],
			geo,
			mid: geo.pointAt(.5),
			endAngle: geo.endAngle(),
			sample: (step = 8) => {
				const count = Math.max(8, Math.ceil(dist / step));
				return Array.from({ length: count + 1 }, (_, i) => geo.pointAt(i / count));
			}
		};
	}
	/** 连线路由解析:route 缺省 = smooth(自适应三次,被其他元素遮挡时自动改走直角避让重排);elbow = 直角正交(始终避让);straight = 直线(不避让,保持语义) */
	function connectorRoute(el, elements, pad = 6) {
		if (el.route === "straight") return polylineRoute([{
			x: el.from[0],
			y: el.from[1]
		}, {
			x: el.to[0],
			y: el.to[1]
		}]);
		const obstacles = obstacleRects(el, elements, pad);
		if (el.route === "elbow") {
			const [h1, h2] = connectorHeadings(el, elements);
			return polylineRoute(routeElbowAvoid({
				x: el.from[0],
				y: el.from[1]
			}, {
				x: el.to[0],
				y: el.to[1]
			}, h1, h2, obstacles));
		}
		const curve = curveRoute(el);
		if (obstacles.length) {
			for (const p of curve.sample(12)) if (obstacles.some((r) => inObstacle(r, p.x, p.y))) {
				const [h1, h2] = connectorHeadings(el, elements);
				return polylineRoute(routeElbowAvoid({
					x: el.from[0],
					y: el.from[1]
				}, {
					x: el.to[0],
					y: el.to[1]
				}, h1, h2, obstacles));
			}
		}
		return curve;
	}
	//#endregion
	//#region src/core/render/misc.ts
	function connectorGeometry(el) {
		const [x1, y1] = el.from;
		const [x2, y2] = el.to;
		const mx = (x1 + x2) / 2;
		const my = (y1 + y2) / 2;
		const vx = x2 - x1;
		const vy = y2 - y1;
		const len = Math.hypot(vx, vy) || 1;
		const curve = el.curve && Math.abs(el.curve) >= 1 ? el.curve : 0;
		function quadratic(control) {
			function pointAt(t) {
				const u = 1 - t;
				return {
					x: u * u * x1 + 2 * u * t * control.x + t * t * x2,
					y: u * u * y1 + 2 * u * t * control.y + t * t * y2
				};
			}
			return {
				auto: false,
				control,
				c1: control,
				c2: control,
				pointAt,
				endAngle: () => Math.atan2(y2 - control.y, x2 - control.x)
			};
		}
		if (curve !== 0) return quadratic({
			x: mx + -vy / len * curve,
			y: my + vx / len * curve
		});
		const horizontal = Math.abs(vx) > Math.abs(vy);
		const sx = Math.sign(vx) || 1;
		const sy = Math.sign(vy) || 1;
		const k = Math.min(Math.max(len * .35, 36), 480);
		const c1 = {
			x: x1 + (horizontal ? sx * k : 0),
			y: y1 + (horizontal ? 0 : sy * k)
		};
		const c2 = {
			x: x2 - (horizontal ? sx * k : 0),
			y: y2 - (horizontal ? 0 : sy * k)
		};
		function pointAt(t) {
			const u = 1 - t;
			const a = u * u * u;
			const b = 3 * u * u * t;
			const c = 3 * u * t * t;
			const d = t * t * t;
			return {
				x: a * x1 + b * c1.x + c * c2.x + d * x2,
				y: a * y1 + b * c1.y + c * c2.y + d * y2
			};
		}
		return {
			auto: true,
			control: pointAt(.5),
			c1,
			c2,
			pointAt,
			endAngle: () => Math.atan2(y2 - c2.y, x2 - c2.x)
		};
	}
	/** 元素布局包围盒:数组格取全部格子的外接框;连线不可作为绑定目标,返回 null;与动画状态无关。
	*  ponytail: 未旋转几何,旋转元素的连线锚点/吸附有偏差(同 snapMove),精确时按 rotatePoint 求旋转角点 */
	function elementBounds(el) {
		if (el.kind === "connector") return null;
		if (el.kind === "arrayCells") {
			const size = el.cellSize ?? 88;
			const gap = el.gap ?? 14;
			const perRow = Math.max(1, el.perRow ?? el.cells.length);
			const rows = Math.ceil(el.cells.length / perRow);
			const cols = Math.min(el.cells.length, perRow);
			if (el.cells.length === 0) return null;
			return {
				x: el.x,
				y: el.y,
				w: cols * size + (cols - 1) * gap,
				h: rows * size + (rows - 1) * gap
			};
		}
		return {
			x: el.x,
			y: el.y,
			w: el.w,
			h: el.h
		};
	}
	/** 元素中心朝 (tx,ty) 的射线与包围盒边界的交点,归一化到 [0..1, 0..1](绑定 focus 与端点解析共用) */
	function centerRayFocus(rect, tx, ty) {
		const cx = rect.x + rect.w / 2;
		const cy = rect.y + rect.h / 2;
		const dx = tx - cx;
		const dy = ty - cy;
		if (dx === 0 && dy === 0) return [.5, 0];
		const sx = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity;
		const sy = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity;
		const s = Math.min(sx, sy);
		return [(cx + dx * s - rect.x) / rect.w, (cy + dy * s - rect.y) / rect.h];
	}
	/**
	* 连线端点解析(纯函数):fromEl/toEl 指向的元素存在时——
	* - 有 fromFocus/toFocus(拖拽吸附绑定时记录的归一化位置):端点固定在元素上的相对位置,元素移动/缩放端点跟随,不滑动不跳边;
	* - 否则取「元素中心朝另一端」的射线与包围盒边界的交点(旧行为兜底);
	* 元素缺失回落到 from/to 原始坐标。
	*/
	function resolveConnector(el, elements) {
		if (!el.fromEl && !el.toEl) return el;
		const boundsOf = (id) => {
			if (!id) return null;
			const target = elements.find((e) => e.id === id);
			return target ? elementBounds(target) : null;
		};
		const anchor = (rect, focus, tx, ty) => {
			if (focus) {
				const fx = Math.min(1, Math.max(0, focus[0]));
				const fy = Math.min(1, Math.max(0, focus[1]));
				return {
					x: rect.x + fx * rect.w,
					y: rect.y + fy * rect.h
				};
			}
			const [fx, fy] = centerRayFocus(rect, tx, ty);
			return {
				x: rect.x + fx * rect.w,
				y: rect.y + fy * rect.h
			};
		};
		const bFrom = boundsOf(el.fromEl);
		const bTo = boundsOf(el.toEl);
		if (!bFrom && !bTo) return el;
		const from = bFrom ? anchor(bFrom, el.fromFocus, el.to[0], el.to[1]) : {
			x: el.from[0],
			y: el.from[1]
		};
		const to = bTo ? anchor(bTo, el.toFocus, from.x, from.y) : {
			x: el.to[0],
			y: el.to[1]
		};
		return {
			...el,
			from: [from.x, from.y],
			to: [to.x, to.y]
		};
	}
	function drawConnector(ctx, el, elements = []) {
		const [x1, y1] = el.from;
		const [x2, y2] = el.to;
		const color = el.color ?? "#475569";
		const lineW = el.width ?? 5;
		const route = connectorRoute(el, elements);
		const mid = route.mid;
		ctx.save();
		ctx.strokeStyle = color;
		ctx.lineWidth = lineW;
		ctx.lineCap = "round";
		ctx.beginPath();
		if (route.mode === "segments") strokeRoundedPolyline(ctx, route.points, {
			x: x2,
			y: y2
		});
		else if (route.mode === "cubic") {
			ctx.moveTo(x1, y1);
			ctx.bezierCurveTo(route.geo.c1.x, route.geo.c1.y, route.geo.c2.x, route.geo.c2.y, x2, y2);
		} else {
			ctx.moveTo(x1, y1);
			ctx.quadraticCurveTo(route.geo.control.x, route.geo.control.y, x2, y2);
		}
		ctx.stroke();
		if (el.arrow !== false) {
			const ang = route.endAngle;
			const size = lineW * 3.2;
			ctx.beginPath();
			ctx.moveTo(x2, y2);
			ctx.lineTo(x2 - size * Math.cos(ang - .45), y2 - size * Math.sin(ang - .45));
			ctx.lineTo(x2 - size * Math.cos(ang + .45), y2 - size * Math.sin(ang + .45));
			ctx.closePath();
			ctx.fillStyle = color;
			ctx.fill();
		}
		if (el.label) {
			ctx.font = sansFont(26, 600);
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			const tw = ctx.measureText(el.label).width;
			roundRect(ctx, mid.x - tw / 2 - 14, mid.y - 24, tw + 28, 48, 24);
			ctx.fillStyle = "#FFFFFF";
			ctx.fill();
			ctx.strokeStyle = "#CBD5E1";
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.fillStyle = "#334155";
			ctx.fillText(el.label, mid.x - tw / 2, mid.y + 1);
		}
		ctx.restore();
	}
	var imgCache = /* @__PURE__ */ new Map();
	/** 取已就绪的图片;未加载完返回 null(下一帧重画时会自动就绪),不阻塞绘制循环 */
	function getImage(src) {
		let entry = imgCache.get(src);
		if (!entry) {
			const img = new Image();
			img.src = src;
			entry = {
				source: img,
				ready: () => img.complete && img.naturalWidth > 0
			};
			imgCache.set(src, entry);
		}
		return entry.ready() ? entry : null;
	}
	/** 位图尺寸:主线程是 HTMLImageElement(naturalWidth),Worker 里是 ImageBitmap(width) */
	function sourceSize(source) {
		const s = source;
		return "naturalWidth" in s ? {
			w: s.naturalWidth,
			h: s.naturalHeight
		} : {
			w: s.width,
			h: s.height
		};
	}
	function drawImageEl(ctx, el) {
		const img = getImage(el.src);
		if (!img) return;
		const { w, h } = sourceSize(img.source);
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, el.radius ?? 12);
		ctx.clip();
		const s = Math.min(el.w / w, el.h / h);
		const dw = w * s;
		const dh = h * s;
		ctx.drawImage(img.source, el.x + (el.w - dw) / 2, el.y + (el.h - dh) / 2, dw, dh);
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/table.ts
	/** 表格:深色表头 + 斑马纹行 + 细网格线,列宽均分,文本垂直居中。 */
	function drawTable(ctx, el, progress) {
		const fontSize = el.fontSize ?? 30;
		const cols = Math.max(1, el.header.length);
		const rows = el.rows.length;
		const colW = el.w / cols;
		const headerH = Math.min(el.h * .34, fontSize * 2.2);
		const rowH = rows > 0 ? (el.h - headerH) / rows : 0;
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 14);
		ctx.clip();
		ctx.fillStyle = el.headerBg ?? "#1E293B";
		ctx.fillRect(el.x, el.y, el.w, headerH);
		ctx.font = sansFont(fontSize * .93, 600);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		el.header.forEach((cell, c) => {
			ctx.fillStyle = "#FFFFFF";
			ctx.fillText(cell, el.x + c * colW + fontSize * .6, el.y + headerH / 2 + 1);
		});
		el.rows.forEach((row, r) => {
			const ry = el.y + headerH + r * rowH;
			ctx.fillStyle = r % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
			ctx.fillRect(el.x, ry, el.w, rowH);
			ctx.font = sansFont(fontSize * .87, 500);
			row.slice(0, cols).forEach((cell, c) => {
				ctx.fillStyle = "#334155";
				ctx.fillText(cell, el.x + c * colW + fontSize * .6, ry + rowH / 2 + 1);
			});
		});
		ctx.strokeStyle = "#E2E8F0";
		ctx.lineWidth = 1.5;
		for (let c = 1; c < cols; c++) {
			const gx = el.x + c * colW;
			ctx.beginPath();
			ctx.moveTo(gx, el.y);
			ctx.lineTo(gx, el.y + el.h);
			ctx.stroke();
		}
		for (let r = 0; r <= rows; r++) {
			const gy = el.y + headerH + r * rowH;
			ctx.beginPath();
			ctx.moveTo(el.x, gy);
			ctx.lineTo(el.x + el.w, gy);
			ctx.stroke();
		}
		ctx.restore();
		roundRect(ctx, el.x, el.y, el.w, el.h, 14);
		ctx.strokeStyle = "#CBD5E1";
		ctx.lineWidth = 2.5;
		ctx.stroke();
	}
	//#endregion
	//#region src/core/render/widgets.ts
	/** 小组件绘制:要点列表 / 进度条 / 按键。全部确定性绘制,不依赖时序状态。 */
	function drawList(ctx, el, progress) {
		const fontSize = el.fontSize ?? 36;
		const itemH = fontSize * 1.9;
		const items = el.items ?? [];
		const shown = progress === void 0 ? items.length : Math.max(0, Math.ceil(progress * items.length));
		if (shown === 0) return;
		const accent = el.accent ?? "#3B82F6";
		const markerW = fontSize * 1.7;
		const totalH = items.length * itemH;
		let ly = el.y + Math.max((el.h - totalH) / 2, 0) + itemH / 2;
		ctx.save();
		ctx.textBaseline = "middle";
		for (let i = 0; i < shown; i++) {
			const mx = el.x + markerW / 2;
			const label = items[i];
			ctx.font = sansFont(fontSize, 500);
			ctx.textAlign = "left";
			ctx.fillStyle = el.color ?? "#1F2937";
			ctx.fillText(label, el.x + markerW, ly + 1);
			if (el.marker === "number") {
				const s = fontSize * 1.15;
				roundRect(ctx, el.x, ly - s / 2, s, s, s * .32);
				ctx.fillStyle = accent;
				ctx.fill();
				ctx.font = sansFont(fontSize * .62, 700);
				ctx.textAlign = "center";
				ctx.fillStyle = "#FFFFFF";
				ctx.fillText(String(i + 1), el.x + s / 2, ly + 1);
			} else if (el.marker === "check") {
				ctx.font = sansFont(fontSize * .95, 700);
				ctx.textAlign = "center";
				ctx.fillStyle = accent;
				ctx.fillText("✓", mx, ly + 1);
			} else {
				ctx.beginPath();
				ctx.arc(mx, ly, fontSize * .18, 0, Math.PI * 2);
				ctx.fillStyle = accent;
				ctx.fill();
			}
			ly += itemH;
		}
		ctx.restore();
	}
	function drawProgress(ctx, el) {
		const fontSize = el.fontSize ?? 30;
		const percent = Math.min(100, Math.max(0, el.percent ?? 60));
		const showText = el.showText !== false;
		const barH = Math.min(fontSize * 1.35, el.label !== void 0 ? el.h - fontSize * 2.1 : el.h);
		ctx.save();
		ctx.font = sansFont(fontSize, 600);
		const textW = showText ? ctx.measureText(`${percent}%`).width : 0;
		const barY = el.label !== void 0 ? el.y + fontSize * 2.1 + Math.max((el.h - fontSize * 2.1 - barH) / 2, 0) : el.y + (el.h - barH) / 2;
		const barW = el.label !== void 0 ? el.w : el.w - (textW > 0 ? textW + fontSize * .5 : 0);
		const radius = barH / 2;
		roundRect(ctx, el.x, barY, barW, barH, radius);
		ctx.fillStyle = el.trackColor ?? "#E2E8F0";
		ctx.fill();
		const fillW = Math.max(barW * (percent / 100), radius);
		roundRect(ctx, el.x, barY, Math.min(fillW, barW), barH, radius);
		ctx.fillStyle = el.barColor ?? "#3B82F6";
		ctx.fill();
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		if (el.label !== void 0) {
			ctx.fillStyle = "#334155";
			ctx.fillText(el.label, el.x, el.y + fontSize * 1.05);
		}
		if (showText) {
			ctx.fillStyle = el.label !== void 0 ? "#64748B" : "#475569";
			ctx.fillText(`${percent}%`, el.x + (el.label !== void 0 ? el.w - textW : barW + fontSize * .25), el.label !== void 0 ? el.y + fontSize * 1.05 : barY + barH / 2 + 1);
		}
		ctx.restore();
	}
	function drawKbd(ctx, el) {
		const fontSize = el.fontSize ?? 36;
		const tokens = el.text.split(/\s+/).filter(Boolean);
		if (tokens.length === 0) return;
		const capH = fontSize * 1.7;
		const gap = fontSize * .45;
		ctx.save();
		ctx.font = sansFont(fontSize, 600);
		const widths = tokens.map((t) => t === "+" ? ctx.measureText(t).width : Math.max(ctx.measureText(t).width + fontSize * .72, fontSize * 1.4));
		const totalW = widths.reduce((a, b) => a + b, 0) + gap * (tokens.length - 1);
		let lx = el.x + Math.max((el.w - totalW) / 2, 0);
		const cy = el.y + el.h / 2;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		tokens.forEach((token, i) => {
			const w = widths[i];
			if (token === "+") {
				ctx.fillStyle = "#94A3B8";
				ctx.fillText(token, lx + w / 2, cy + 1);
			} else {
				const capY = cy - capH / 2;
				roundRect(ctx, lx, capY + fontSize * .14, w, capH, fontSize * .32);
				ctx.fillStyle = "rgba(100,116,139,0.45)";
				ctx.fill();
				roundRect(ctx, lx, capY, w, capH, fontSize * .32);
				ctx.fillStyle = el.bg ?? "#FFFFFF";
				ctx.fill();
				ctx.strokeStyle = "#CBD5E1";
				ctx.lineWidth = 2;
				ctx.stroke();
				ctx.fillStyle = "#1E293B";
				ctx.fillText(token, lx + w / 2, capY + capH / 2);
			}
			lx += w + gap;
		});
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/index.ts
	/**
	* 帧渲染入口:drawFrame(ctx, project, t) 是纯函数式的一帧绘制。
	* 预览(rAF 循环)与将来的逐帧导出走这同一个函数,这是「预览即导出」的唯一保证点。
	*/
	function drawFrame(ctx, project, t) {
		const w = project.canvas?.width ?? 1920;
		const h = project.canvas?.height ?? 1080;
		ctx.save();
		ctx.fillStyle = project.canvas?.bg ?? "#F4F4F1";
		ctx.fillRect(0, 0, w, h);
		const { index, localT } = locate(project, t);
		const scene = project.scenes[index];
		if (scene) for (const el of scene.elements) drawElement(ctx, el, localT, scene.elements);
		ctx.restore();
	}
	function drawElement(ctx, el, localT, sceneElements) {
		const st = animState(localT, el.anim);
		if (!st.active) return;
		const visual = animVisual(el.anim, st.p);
		ctx.save();
		ctx.globalAlpha *= visual.alpha;
		if (visual.dx !== 0 || visual.dy !== 0) ctx.translate(visual.dx, visual.dy);
		if (visual.scale !== 1 || visual.rotation !== 0) {
			const cx = el.x + el.w / 2;
			const cy = el.y + el.h / 2;
			ctx.translate(cx, cy);
			if (visual.rotation !== 0) ctx.rotate(visual.rotation);
			if (visual.scale !== 1) ctx.scale(visual.scale, visual.scale);
			ctx.translate(-cx, -cy);
		}
		const rotateDeg = el.kind === "connector" ? 0 : el.rotate ?? (el.kind === "note" ? -2 : 0);
		if (rotateDeg !== 0) {
			const rx = el.x + el.w / 2;
			const ry = el.y + el.h / 2;
			ctx.translate(rx, ry);
			ctx.rotate(rotateDeg * Math.PI / 180);
			ctx.translate(-rx, -ry);
		}
		if (visual.wipeWidth !== null) {
			ctx.beginPath();
			ctx.rect(el.x - 4, el.y - 4, el.w * visual.wipeWidth + 8, el.h + 8);
			ctx.clip();
		}
		const progress = visual.progress;
		switch (el.kind) {
			case "title":
				drawTitle(ctx, el, progress);
				break;
			case "artText":
				drawArtText(ctx, el, progress);
				break;
			case "shape":
				drawShape(ctx, el);
				break;
			case "text":
				drawText(ctx, el, progress);
				break;
			case "input":
				drawInput(ctx, el);
				break;
			case "note":
				drawNote(ctx, el, progress);
				break;
			case "badge":
				drawBadge(ctx, el);
				break;
			case "code":
				drawCode(ctx, el, progress);
				break;
			case "table":
				drawTable(ctx, el, progress);
				break;
			case "arrayCells":
				drawArrayCells(ctx, el);
				break;
			case "connector":
				drawConnector(ctx, resolveConnector(el, sceneElements), sceneElements);
				break;
			case "image":
				drawImageEl(ctx, el);
				break;
			case "list":
				drawList(ctx, el, progress);
				break;
			case "stepCard":
				drawStepCard(ctx, el, progress);
				break;
			case "terminal":
				drawTerminal(ctx, el, progress);
				break;
			case "progress":
				drawProgress(ctx, el);
				break;
			case "kbd":
				drawKbd(ctx, el);
				break;
			case "browser": drawBrowser(ctx, el);
		}
		ctx.restore();
	}
	//#endregion
	//#region src/core/playerEntry.ts
	/**
	* HTML 导出的独立播放器入口:只允许 import src/core 下的模块(渲染唯一路径),
	* 由 scripts/build-player.mjs 打成 IIFE 后经 ?raw 内联进导出的单文件 HTML。
	* 播放/循环/配音同步逻辑与编辑器保持同一时间轴语义。
	*/
	function el(id) {
		const node = document.getElementById(id);
		return node instanceof HTMLElement ? node : null;
	}
	function main() {
		const canvas = el("tmd-stage");
		const dataTag = el("tmd-project-data");
		const stageBox = el("tmd-stage-box");
		if (!canvas || !(dataTag instanceof HTMLScriptElement)) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		let project;
		try {
			project = normalizeProject(JSON.parse(dataTag.textContent ?? "null"));
		} catch (err) {
			ctx.fillStyle = "#F4F4F1";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "#DC2626";
			ctx.font = "600 28px system-ui, sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(`项目数据解析失败:${String(err)}`, canvas.width / 2, canvas.height / 2);
			return;
		}
		const w = project.canvas?.width ?? 1920;
		const h = project.canvas?.height ?? 1080;
		canvas.width = w;
		canvas.height = h;
		const duration = projectDuration(project);
		const bar = el("tmd-progress-bar");
		const timeLabel = el("tmd-time");
		const playIcon = el("tmd-play-icon");
		const fit = () => {
			const scale = Math.min(window.innerWidth / w, Math.max(window.innerHeight - 44, 120) / h);
			canvas.style.width = `${Math.max(Math.round(w * scale), 64)}px`;
			canvas.style.height = `${Math.max(Math.round(h * scale), 36)}px`;
			if (stageBox) stageBox.style.height = `${Math.max(Math.round(h * scale), 36)}px`;
		};
		window.addEventListener("resize", fit);
		fit();
		const audioPool = /* @__PURE__ */ new Map();
		upsertSceneAudioPool(audioPool, project);
		let t = 0;
		let playing = true;
		const toggle = () => {
			playing = !playing;
			if (!playing) pauseSceneAudio(audioPool);
			if (playIcon) playIcon.style.opacity = playing ? "0" : "1";
		};
		const seek = (delta) => {
			t = Math.min(Math.max(0, t + delta), Math.max(duration - .01, 0));
			pauseSceneAudio(audioPool);
		};
		canvas.addEventListener("click", toggle);
		window.addEventListener("keydown", (e) => {
			if (e.code === "Space") {
				e.preventDefault();
				toggle();
			} else if (e.code === "ArrowLeft") seek(-5);
			else if (e.code === "ArrowRight") seek(5);
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") {
				playing = false;
				pauseSceneAudio(audioPool);
				if (playIcon) playIcon.style.opacity = "1";
			}
		});
		let last = performance.now();
		const loop = (now) => {
			requestAnimationFrame(loop);
			const dt = Math.min(.1, (now - last) / 1e3);
			last = now;
			if (playing) {
				const next = t + dt;
				if (duration > 0 && next >= duration) {
					t = 0;
					pauseSceneAudio(audioPool);
				} else t = next;
			}
			drawFrame(ctx, project, t);
			syncSceneAudio(audioPool, project, t, playing);
			if (bar) bar.style.width = `${duration > 0 ? t / duration * 100 : 0}%`;
			if (timeLabel) timeLabel.textContent = `${t.toFixed(1)}s / ${duration.toFixed(1)}s`;
		};
		requestAnimationFrame(loop);
	}
	main();
	//#endregion
})();

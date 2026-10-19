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
		for (const el of scene.elements) {
			end = Math.max(end, el.anim.start + el.anim.duration);
			if (el.exit) end = Math.max(end, el.exit.start + el.exit.duration);
			if (el.tweens) for (const tw of el.tweens) end = Math.max(end, tw.start + tw.duration);
		}
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
	function clamp01$1(v) {
		return Math.min(1, Math.max(0, v));
	}
	function easeOutCubic(p) {
		const q = 1 - clamp01$1(p);
		return 1 - q * q * q;
	}
	function easeInOutCubic(p) {
		const x = clamp01$1(p);
		return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
	}
	/** 回弹缓动:终点恰为 1,中途允许超过 1(用于 pop 的过冲缩放) */
	function easeOutBack(p) {
		const c1 = 1.70158;
		const c3 = 2.70158;
		const x = clamp01$1(p) - 1;
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
	* file-size-exempt:归一化入口集中所有 kind 的字段钳制,拆分会让同类守卫散落多处。
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
		browser: true,
		devNode: true,
		phone: true,
		aiChat: true,
		barChart: true,
		lineChart: true,
		pieChart: true,
		cursor: true,
		folderTree: true,
		codeDiff: true,
		spotlight: true,
		gridBg: true,
		groupPanel: true,
		lane: true,
		quote: true,
		formula: true,
		avatar: true,
		person: true
	};
	var EXIT_TYPES = {
		fadeOut: true,
		slideOutLeft: true,
		slideOutRight: true,
		slideOutUp: true,
		slideOutDown: true,
		zoomOut: true,
		wipeOut: true
	};
	var EMPHASIS_TYPES = {
		pulse: true,
		shake: true,
		glow: true,
		flash: true,
		ring: true,
		highlightLines: true,
		dashFlow: true
	};
	/** 强调事件缺省时长(秒):未声明 duration 时按类型取 */
	var EMPHASIS_DEFAULT_DURATION = {
		pulse: .6,
		shake: .5,
		glow: .9,
		flash: .4,
		ring: .9,
		highlightLines: 1.4,
		dashFlow: 2.5
	};
	/** 补间白名单:percent 仅 progress,activeIndex 仅 arrayCells;不上通用关键帧 */
	var TWEEN_FIELDS = {
		percent: true,
		activeIndex: true
	};
	var TWEEN_FIELD_KIND = {
		percent: "progress",
		activeIndex: "arrayCells"
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
	/** 离场归一:类型非法丢弃;start 钳到不早于入场结束;时长下限 0.05 */
	function normalizeExit(raw, entranceEnd) {
		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
		const r = raw;
		if (typeof r.type !== "string" || EXIT_TYPES[r.type] !== true) return void 0;
		const easing = typeof r.easing === "string" && EASINGS.has(r.easing) ? r.easing : void 0;
		return {
			type: r.type,
			start: Math.max(entranceEnd, num(r.start, entranceEnd)),
			duration: Math.max(.05, num(r.duration, .5)),
			...easing ? { easing } : {}
		};
	}
	/** 强调事件归一:类型/负 start 丢弃;落在离场开始后的事件丢弃(元素已不存在);时长缺省按类型 */
	function normalizeEmphasis(raw, exitStart) {
		if (!Array.isArray(raw)) return [];
		const out = [];
		for (const item of raw) {
			if (typeof item !== "object" || item === null) continue;
			const r = item;
			if (typeof r.type !== "string" || EMPHASIS_TYPES[r.type] !== true) continue;
			const start = num(r.start, 0);
			if (start < 0) continue;
			if (exitStart !== void 0 && start >= exitStart) continue;
			const easing = typeof r.easing === "string" && EASINGS.has(r.easing) ? r.easing : void 0;
			const strength = num(r.strength, 1);
			const ev = {
				type: r.type,
				start,
				duration: Math.max(.05, num(r.duration, EMPHASIS_DEFAULT_DURATION[r.type] ?? .6)),
				...easing ? { easing } : {},
				...strength !== 1 ? { strength: Math.min(3, Math.max(.1, strength)) } : {}
			};
			if (r.type === "highlightLines") {
				const l = r.lines;
				if (!(Array.isArray(l) && l.length === 2 && l.every((n) => Number.isFinite(Number(n))))) continue;
				const a = Math.max(1, Math.round(Number(l[0])));
				const b = Math.max(1, Math.round(Number(l[1])));
				ev.lines = a <= b ? [a, b] : [b, a];
			}
			out.push(ev);
		}
		return out;
	}
	/** 补间归一:字段白名单 + kind 匹配(percent 仅 progress、activeIndex 仅 arrayCells);to 非数丢弃 */
	function normalizeTweens(raw, kind) {
		if (!Array.isArray(raw)) return [];
		const out = [];
		for (const item of raw) {
			if (typeof item !== "object" || item === null) continue;
			const r = item;
			if (typeof r.field !== "string" || TWEEN_FIELDS[r.field] !== true || TWEEN_FIELD_KIND[r.field] !== kind) continue;
			if (!Number.isFinite(Number(r.to))) continue;
			const easing = typeof r.easing === "string" && EASINGS.has(r.easing) ? r.easing : void 0;
			const tw = {
				field: r.field,
				to: Number(r.to),
				start: Math.max(0, num(r.start, 0)),
				duration: Math.max(.05, num(r.duration, 1)),
				...easing ? { easing } : {}
			};
			if (r.from !== void 0 && Number.isFinite(Number(r.from))) tw.from = Number(r.from);
			out.push(tw);
		}
		return out;
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
		if (el.kind === "aiChat") {
			for (const key of [
				"title",
				"prompt",
				"reply"
			]) if (connector[key] !== void 0 && typeof connector[key] !== "string") delete connector[key];
		}
		if (el.kind === "devNode") {
			if (connector.label !== void 0 && typeof connector.label !== "string") delete connector.label;
			if (connector.sub !== void 0 && typeof connector.sub !== "string") delete connector.sub;
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
		const timeline = el;
		const exit = normalizeExit(raw.exit, base.anim.start + base.anim.duration);
		if (exit) timeline.exit = exit;
		else delete timeline.exit;
		const emphasis = normalizeEmphasis(raw.emphasis, exit?.start);
		if (emphasis.length > 0) timeline.emphasis = emphasis;
		else delete timeline.emphasis;
		const tweens = normalizeTweens(raw.tweens, el.kind);
		if (tweens.length > 0) timeline.tweens = tweens;
		else delete timeline.tweens;
		if (el.kind === "arrayCells" && timeline.activeIndex != null) {
			const n = Number(timeline.activeIndex);
			if (Number.isFinite(n)) timeline.activeIndex = Math.round(n);
			else delete timeline.activeIndex;
		}
		if (el.kind === "spotlight") {
			if (timeline.strength != null) {
				const s = Number(timeline.strength);
				if (Number.isFinite(s)) timeline.strength = Math.min(1, Math.max(0, s));
				else delete timeline.strength;
			}
			if (timeline.shape !== void 0 && !["rect", "ellipse"].includes(String(timeline.shape))) delete timeline.shape;
		}
		if (el.kind === "lane") {
			if (timeline.count != null) {
				const c = Number(timeline.count);
				if (Number.isFinite(c)) timeline.count = Math.min(4, Math.max(2, Math.round(c)));
				else delete timeline.count;
			}
			if (timeline.direction !== void 0 && !["h", "v"].includes(String(timeline.direction))) delete timeline.direction;
		}
		if (el.kind === "barChart" || el.kind === "lineChart" || el.kind === "pieChart") {
			const key = el.kind === "pieChart" ? "slices" : "series";
			const isLine = el.kind === "lineChart";
			const arr = timeline[key];
			if (!Array.isArray(arr)) timeline[key] = [];
			else timeline[key] = arr.flatMap((s) => {
				if (typeof s !== "object" || s === null) return [];
				const rec = s;
				const label = typeof rec.label === "string" ? rec.label : "";
				const color = typeof rec.color === "string" ? rec.color : void 0;
				if (isLine) {
					const pts = Array.isArray(rec.points) ? rec.points.map((n) => Number.isFinite(Number(n)) ? Number(n) : 0) : [];
					return [{
						label,
						...color ? { color } : {},
						points: pts
					}];
				}
				return [{
					label,
					value: Number.isFinite(Number(rec.value)) ? Number(rec.value) : 0,
					...color ? { color } : {}
				}];
			});
		}
		if (el.kind === "cursor") {
			timeline.points = (Array.isArray(timeline.points) ? timeline.points : []).filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(Number(n)))).map((p) => [Number(p[0]), Number(p[1])]);
			if (timeline.clicks !== void 0) timeline.clicks = Array.isArray(timeline.clicks) ? timeline.clicks.filter((n) => Number.isFinite(Number(n))).map(Number) : [];
			const hold = timeline.hold;
			if (!(Array.isArray(hold) && hold.length === 2 && hold.every((n) => Number.isFinite(Number(n))))) delete timeline.hold;
			else timeline.hold = [Number(hold[0]), Number(hold[1])];
		}
		if (el.kind === "codeDiff") timeline.hunks = (Array.isArray(timeline.hunks) ? timeline.hunks : []).flatMap((h) => {
			if (typeof h !== "object" || h === null) return [];
			const rec = h;
			const ctx = typeof rec.ctx === "string" ? rec.ctx : void 0;
			const lines = (Array.isArray(rec.lines) ? rec.lines : []).map((ln) => {
				const r = typeof ln === "object" && ln !== null ? ln : {};
				return {
					tag: r.tag === "+" ? "+" : r.tag === "-" ? "-" : " ",
					text: typeof r.text === "string" ? r.text : String(r.text ?? "")
				};
			});
			return [{
				...ctx ? { ctx } : {},
				lines
			}];
		});
		if (el.kind === "folderTree") timeline.items = (Array.isArray(timeline.items) ? timeline.items : []).flatMap((it) => {
			if (typeof it !== "object" || it === null) return [];
			const rec = it;
			const depth = Number.isFinite(Number(rec.depth)) ? Math.max(0, Math.round(Number(rec.depth))) : void 0;
			return [{
				name: typeof rec.name === "string" ? rec.name : String(rec.name ?? ""),
				...depth !== void 0 ? { depth } : {},
				...rec.icon === "dir" || rec.icon === "file" ? { icon: rec.icon } : {},
				...typeof rec.comment === "string" ? { comment: rec.comment } : {}
			}];
		});
		const enumGuard = (key, allowed) => {
			if (timeline[key] !== void 0 && !allowed.includes(String(timeline[key]))) delete timeline[key];
		};
		enumGuard("legend", [
			"right",
			"bottom",
			"none"
		]);
		enumGuard("status", [
			"online",
			"offline",
			"busy"
		]);
		enumGuard("pose", [
			"stand",
			"point",
			"think"
		]);
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
	/** 离场求值:in = 未开始(常驻),out = 离场窗口内(q 为 [0,1] 进度),gone = 已离场(元素不存在) */
	function exitState(localT, exit) {
		if (localT + 1e-6 < exit.start) return {
			phase: "in",
			q: 0
		};
		const q = exit.duration <= 0 ? 1 : Math.min(1, (localT - exit.start) / exit.duration);
		return q >= 1 ? {
			phase: "gone",
			q: 1
		} : {
			phase: "out",
			q
		};
	}
	function resolveExitEasing(exit) {
		if (exit.easing) return EASING_FNS[exit.easing] ?? easeInOutCubic;
		return easeInOutCubic;
	}
	/** 离场动画 -> 视觉参数:与入场 visual 复合(alpha 相乘、位移叠加、scale 相乘) */
	function exitVisual(exit, q) {
		const e = resolveExitEasing(exit)(q);
		switch (exit.type) {
			case "fadeOut": return {
				alpha: 1 - e,
				dx: 0,
				dy: 0,
				scale: 1,
				wipeWidth: null
			};
			case "slideOutLeft": return {
				alpha: 1,
				dx: -e * 320,
				dy: 0,
				scale: 1,
				wipeWidth: null
			};
			case "slideOutRight": return {
				alpha: 1,
				dx: e * 320,
				dy: 0,
				scale: 1,
				wipeWidth: null
			};
			case "slideOutUp": return {
				alpha: 1,
				dx: 0,
				dy: -e * 200,
				scale: 1,
				wipeWidth: null
			};
			case "slideOutDown": return {
				alpha: 1,
				dx: 0,
				dy: e * 200,
				scale: 1,
				wipeWidth: null
			};
			case "zoomOut": return {
				alpha: 1 - e,
				dx: 0,
				dy: 0,
				scale: 1 - .4 * e,
				wipeWidth: null
			};
			case "wipeOut": return {
				alpha: 1,
				dx: 0,
				dy: 0,
				scale: 1,
				wipeWidth: 1 - e
			};
		}
	}
	var NO_FX = {
		scaleMul: 1,
		dx: 0,
		dy: 0,
		glow: 0,
		flashAlpha: 0,
		ringQ: null,
		highlightLines: null,
		dashFlow: null
	};
	function resolveEmphasisEasing(ev) {
		if (ev.easing) return EASING_FNS[ev.easing] ?? easeOutCubic;
		if (ev.type === "pulse" || ev.type === "shake") return easeInOutCubic;
		if (ev.type === "highlightLines" || ev.type === "dashFlow") return EASING_FNS.linear;
		return easeOutCubic;
	}
	/** 强调求值:纯函数,同一 (localT, events) 恒同结果;未命中返回共享空效果(调用方不得修改) */
	function emphasisFx(localT, events) {
		if (!events || events.length === 0) return NO_FX;
		const fx = { ...NO_FX };
		for (const ev of events) {
			if (localT + 1e-6 < ev.start) continue;
			const q = (localT - ev.start) / Math.max(.05, ev.duration);
			if (q > 1) continue;
			const e = resolveEmphasisEasing(ev)(Math.min(1, Math.max(0, q)));
			const s = ev.strength ?? 1;
			switch (ev.type) {
				case "pulse":
					fx.scaleMul *= 1 + Math.sin(Math.PI * e) * .1 * s;
					break;
				case "shake":
					fx.dx += Math.sin(q * Math.PI * 6) * 9 * s * (1 - e);
					break;
				case "glow":
					fx.glow = Math.max(fx.glow, Math.sin(Math.PI * e) * 22 * s);
					break;
				case "flash":
					fx.flashAlpha = Math.max(fx.flashAlpha, Math.sin(Math.PI * e) * .75 * Math.min(1.3, s));
					break;
				case "ring":
					fx.ringQ = e;
					break;
				case "highlightLines":
					fx.highlightLines = {
						lines: ev.lines ?? [1, 1],
						alpha: Math.sin(Math.PI * e)
					};
					break;
				case "dashFlow": fx.dashFlow = 60 * s;
			}
		}
		return fx;
	}
	/** 补间求值:白名单字段随时间插值;命中多个时后者覆盖前者;未命中返回原元素(免拷贝) */
	function applyTweens(el, localT) {
		if (!el.tweens || el.tweens.length === 0) return el;
		let out = null;
		for (const tw of el.tweens) {
			if (localT + 1e-6 < tw.start) continue;
			const q = Math.min(1, (localT - tw.start) / tw.duration);
			const e = tw.easing ? (EASING_FNS[tw.easing] ?? ((p) => p))(q) : q;
			const rec = out ?? el;
			const base = tw.from ?? (typeof rec[tw.field] === "number" ? rec[tw.field] : 0);
			if (!out) out = { ...el };
			out[tw.field] = base + (tw.to - base) * e;
		}
		return out ?? el;
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
	var SANS$1 = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif`;
	var MONO = `"SF Mono",Menlo,Consolas,"Liberation Mono",monospace`;
	function sansFont(size, weight = 600) {
		return `${weight} ${size}px ${SANS$1}`;
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
	function drawCode(ctx, el, progress, hl) {
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
		if (hl) {
			const [ha, hb] = hl.lines;
			ctx.fillStyle = el.dark ? `rgba(96,165,250,${(.3 * hl.alpha).toFixed(3)})` : `rgba(59,130,246,${(.14 * hl.alpha).toFixed(3)})`;
			ctx.fillRect(el.x, el.y + headerH + lineH * .2 + (ha - 1) * lineH, el.w, (hb - ha + 1) * lineH);
		}
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
	function drawTerminal(ctx, el, progress, hl) {
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
		if (hl) {
			const [ha, hb] = hl.lines;
			ctx.fillStyle = dark ? `rgba(96,165,250,${(.3 * hl.alpha).toFixed(3)})` : `rgba(59,130,246,${(.14 * hl.alpha).toFixed(3)})`;
			ctx.fillRect(el.x, el.y + headerH + lineH * .2 + (ha - 1) * lineH, el.w, (hb - ha + 1) * lineH);
		}
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
	/** 手机 mock:圆角机身(带屏框) + 顶部刘海胶囊 + 底部 home 条;屏幕区留给后绘制元素叠加内容 */
	function drawPhone(ctx, el) {
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, Math.min(44, el.w * .14));
		ctx.fillStyle = el.frame ?? "#0F172A";
		ctx.fill();
		const bezel = Math.max(10, el.w * .035);
		const sx = el.x + bezel;
		const sy = el.y + bezel;
		const sw = el.w - bezel * 2;
		const sh = el.h - bezel * 2;
		roundRect(ctx, sx, sy, sw, sh, Math.min(32, sw * .1));
		ctx.fillStyle = el.body ?? "#FFFFFF";
		ctx.fill();
		const notchW = Math.min(sw * .34, 120);
		const notchH = Math.max(12, bezel * .9);
		roundRect(ctx, sx + (sw - notchW) / 2, sy + 8, notchW, notchH, notchH / 2);
		ctx.fillStyle = el.frame ?? "#0F172A";
		ctx.fill();
		const barW = sw * .36;
		roundRect(ctx, sx + (sw - barW) / 2, sy + sh - 12, barW, 5, 2.5);
		ctx.globalAlpha = .35;
		ctx.fillStyle = el.frame ?? "#0F172A";
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.restore();
	}
	var AI_ACCENT = "#7C3AED";
	/** AI 对话卡:星标 + 标题头部;用户消息右对齐气泡,AI 回复占余下高度(支持高亮芯片) */
	function drawAiChat(ctx, el, progress) {
		const fontSize = el.fontSize ?? 26;
		const dark = el.dark === true;
		const bg = dark ? "#0F172A" : "#FFFFFF";
		const fg = dark ? "#E2E8F0" : "#1F2937";
		const sub = dark ? "#94A3B8" : "#64748B";
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 16);
		ctx.fillStyle = bg;
		ctx.fill();
		ctx.strokeStyle = dark ? "#334155" : "#E2E8F0";
		ctx.lineWidth = 2;
		ctx.stroke();
		const headerH = fontSize * 2.2;
		const cx = el.x + fontSize * 1.15;
		const cy = el.y + headerH / 2;
		const r = fontSize * .5;
		ctx.beginPath();
		ctx.moveTo(cx, cy - r);
		ctx.quadraticCurveTo(cx + r * .22, cy - r * .22, cx + r, cy);
		ctx.quadraticCurveTo(cx + r * .22, cy + r * .22, cx, cy + r);
		ctx.quadraticCurveTo(cx - r * .22, cy + r * .22, cx - r, cy);
		ctx.quadraticCurveTo(cx - r * .22, cy - r * .22, cx, cy - r);
		ctx.fillStyle = AI_ACCENT;
		ctx.fill();
		ctx.font = sansFont(fontSize * .9, 600);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = fg;
		ctx.fillText(el.title ?? "AI 助手", cx + r + fontSize * .55, cy + 1, el.w - (cx + r + fontSize * .55 - el.x) - 12);
		ctx.strokeStyle = dark ? "#334155" : "#E2E8F0";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(el.x, el.y + headerH);
		ctx.lineTo(el.x + el.w, el.y + headerH);
		ctx.stroke();
		const padX = fontSize * .9;
		const innerW = el.w - padX * 2;
		let cursorY = el.y + headerH + fontSize * .8;
		if (el.prompt) {
			const bubbleH = fontSize * 2.1;
			const bubbleW = Math.min(innerW * .78, padX + el.prompt.length * fontSize * .62);
			roundRect(ctx, el.x + el.w - padX - bubbleW, cursorY, bubbleW, bubbleH, fontSize * .7);
			ctx.fillStyle = dark ? "#4C1D95" : "#EDE9FE";
			ctx.fill();
			ctx.font = sansFont(fontSize * .85, 400);
			ctx.fillStyle = dark ? "#E9D5FF" : "#4C1D95";
			ctx.textAlign = "left";
			ctx.save();
			ctx.beginPath();
			ctx.rect(el.x + el.w - padX - bubbleW + fontSize * .5, cursorY, bubbleW - fontSize, bubbleH);
			ctx.clip();
			drawRichText(ctx, el.x + el.w - padX - bubbleW + fontSize * .5, cursorY + (bubbleH - fontSize * 1.5) / 2, bubbleW - fontSize, fontSize * 1.5, el.prompt, {
				fontSize: fontSize * .85,
				color: dark ? "#E9D5FF" : "#4C1D95",
				align: "left"
			});
			ctx.restore();
			cursorY += bubbleH + fontSize * .7;
		}
		if (el.reply) drawRichText(ctx, el.x + padX, cursorY, innerW, el.y + el.h - cursorY - fontSize * .8, el.reply, {
			fontSize: fontSize * .85,
			color: fg,
			align: "left",
			progress
		});
		else if (!el.prompt) {
			ctx.font = sansFont(fontSize * .85, 400);
			ctx.fillStyle = sub;
			ctx.fillText("输入消息…", el.x + padX, cursorY + fontSize);
		}
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
		const active = el.activeIndex ?? -1;
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
			if (i === active) {
				ctx.strokeStyle = "#2563EB";
				ctx.lineWidth = 4;
				roundRect(ctx, cx + 2, cy + 2, size - 4, size - 4, size * .16);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(cx + size / 2 - 10, cy - 4);
				ctx.lineTo(cx + size / 2 + 10, cy - 4);
				ctx.lineTo(cx + size / 2, cy + 10);
				ctx.closePath();
				ctx.fillStyle = "#2563EB";
				ctx.fill();
			}
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
		const seed = Math.max(-1e9, Math.min(1e9, Math.round(el.sketchSeed ?? hashSeed(el.id)))) + salt;
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
	function drawTitle$1(ctx, el, progress) {
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
	//#region src/core/render/devNode.ts
	/**
	* 开发组件节点:架构图常用资源(数据库/缓存/对象存储/云/服务器/API/消息队列/容器)。
	* 布局 = 左侧图标色块(h×h) + 右侧主名称/副标题;图标按变体程序化绘制,全部为 (project,t) 纯函数。
	*/
	var DEV_META = {
		database: {
			color: "#0284C7",
			name: "数据库"
		},
		redis: {
			color: "#DC382D",
			name: "Redis"
		},
		obs: {
			color: "#EA580C",
			name: "对象存储"
		},
		cloud: {
			color: "#0EA5E9",
			name: "云"
		},
		server: {
			color: "#475569",
			name: "服务器"
		},
		api: {
			color: "#16A34A",
			name: "API"
		},
		queue: {
			color: "#D97706",
			name: "消息队列"
		},
		container: {
			color: "#2563EB",
			name: "容器"
		},
		gateway: {
			color: "#0891B2",
			name: "网关"
		},
		loadBalancer: {
			color: "#059669",
			name: "负载均衡"
		},
		cdn: {
			color: "#6366F1",
			name: "CDN"
		},
		auth: {
			color: "#B45309",
			name: "认证"
		},
		function: {
			color: "#DB2777",
			name: "函数计算"
		},
		git: {
			color: "#EA580C",
			name: "代码仓库"
		}
	};
	var SANS = "ui-sans-serif, system-ui, \"PingFang SC\", \"Microsoft YaHei\", sans-serif";
	/** 变体图标:在 (ox,oy) 边长 s 的方盒内以主色描边绘制,线宽按盒尺寸等比 */
	function drawGlyph(ctx, dev, ox, oy, s, color) {
		const lw = Math.max(2, s * .05);
		const cx = ox + s / 2;
		const cy = oy + s / 2;
		ctx.strokeStyle = color;
		ctx.lineWidth = lw;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.beginPath();
		switch (dev) {
			case "database": {
				const rx = s * .26;
				const ry = s * .11;
				ctx.moveTo(cx - rx, cy - ry);
				ctx.lineTo(cx - rx, cy + s * .2 - ry);
				ctx.ellipse(cx, cy + s * .2 - ry, rx, ry, 0, Math.PI, 0, true);
				ctx.lineTo(cx + rx, cy - ry);
				ctx.ellipse(cx, cy - ry, rx, ry, 0, 0, Math.PI, true);
				ctx.closePath();
				ctx.moveTo(cx - rx, cy + s * .1 - ry);
				ctx.ellipse(cx, cy + s * .1 - ry, rx, ry, 0, 0, Math.PI, false);
				break;
			}
			case "redis": {
				const r = s * .28;
				for (const dy of [-s * .09, s * .09]) {
					ctx.moveTo(cx, cy - r * .62 + dy);
					ctx.lineTo(cx + r, cy + dy);
					ctx.lineTo(cx, cy + r * .62 + dy);
					ctx.lineTo(cx - r, cy + dy);
					ctx.closePath();
				}
				break;
			}
			case "obs": {
				const rw = s * .27;
				const top = cy - s * .18;
				ctx.moveTo(cx - rw, top);
				ctx.lineTo(cx - rw * .72, cy + s * .22);
				ctx.lineTo(cx + rw * .72, cy + s * .22);
				ctx.lineTo(cx + rw, top);
				ctx.stroke();
				ctx.beginPath();
				ctx.ellipse(cx, top, rw, s * .1, 0, 0, Math.PI * 2);
				break;
			}
			case "cloud":
				ctx.arc(cx - s * .14, cy + s * .06, s * .13, Math.PI * .5, Math.PI * 1.5);
				ctx.arc(cx - s * .02, cy - s * .1, s * .15, Math.PI * .9, Math.PI * 2.05);
				ctx.arc(cx + s * .16, cy + s * .02, s * .12, Math.PI * 1.5, Math.PI * .5);
				break;
			case "server": {
				const rw = s * .3;
				const rh = s * .13;
				for (const dy of [-s * .16, s * .03]) {
					ctx.moveTo(cx - rw, cy + dy);
					ctx.lineTo(cx + rw, cy + dy);
					ctx.lineTo(cx + rw, cy + dy + rh);
					ctx.lineTo(cx - rw, cy + dy + rh);
					ctx.closePath();
					ctx.moveTo(cx - rw * .6, cy + dy + rh / 2);
					ctx.arc(cx - rw * .6, cy + dy + rh / 2, lw * .7, 0, Math.PI * 2);
				}
				break;
			}
			case "api":
				ctx.font = `700 ${Math.round(s * .4)}px ${SANS}`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillStyle = color;
				ctx.fillText("</>", cx, cy + s * .02);
				return;
			case "queue": {
				const rw = s * .26;
				for (const dy of [
					-s * .16,
					0,
					s * .16
				]) {
					ctx.moveTo(cx - rw, cy + dy);
					ctx.lineTo(cx + rw, cy + dy);
					ctx.moveTo(cx - rw * .55, cy + dy);
					ctx.arc(cx - rw * .55, cy + dy, lw * .7, 0, Math.PI * 2);
				}
				break;
			}
			case "container": {
				const r = s * .27;
				const hex = [];
				for (let i = 0; i < 6; i++) {
					const a = -Math.PI / 2 + i * Math.PI / 3;
					hex.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
				}
				ctx.moveTo(hex[0][0], hex[0][1]);
				for (let i = 1; i < 6; i++) ctx.lineTo(hex[i][0], hex[i][1]);
				ctx.closePath();
				ctx.moveTo(hex[0][0], hex[0][1]);
				ctx.lineTo(cx, cy);
				ctx.lineTo(hex[2][0], hex[2][1]);
				ctx.moveTo(cx, cy);
				ctx.lineTo(hex[4][0], hex[4][1]);
				break;
			}
			case "gateway": {
				const rw = s * .28;
				ctx.moveTo(cx - rw, cy - s * .14);
				ctx.lineTo(cx + rw * .5, cy - s * .14);
				ctx.lineTo(cx + rw * .5, cy - s * .22);
				ctx.lineTo(cx + rw, cy - s * .14);
				ctx.lineTo(cx + rw * .5, cy - s * .06);
				ctx.lineTo(cx + rw * .5, cy + s * .02);
				ctx.moveTo(cx + rw, cy + s * .14);
				ctx.lineTo(cx - rw * .5, cy + s * .14);
				ctx.lineTo(cx - rw * .5, cy + s * .06);
				ctx.lineTo(cx - rw, cy + s * .14);
				ctx.lineTo(cx - rw * .5, cy + s * .22);
				ctx.lineTo(cx - rw * .5, cy + s * .3);
				ctx.moveTo(cx, cy - s * .28);
				ctx.lineTo(cx, cy + s * .28);
				break;
			}
			case "loadBalancer": {
				const rw = s * .3;
				ctx.moveTo(cx - rw, cy);
				ctx.lineTo(cx, cy);
				ctx.moveTo(cx, cy);
				ctx.lineTo(cx + rw, cy - s * .2);
				ctx.moveTo(cx, cy);
				ctx.lineTo(cx + rw, cy);
				ctx.moveTo(cx, cy);
				ctx.lineTo(cx + rw, cy + s * .2);
				break;
			}
			case "cdn": {
				const r = s * .26;
				ctx.moveTo(cx + r, cy);
				ctx.arc(cx, cy, r, 0, Math.PI * 2);
				ctx.moveTo(cx - r, cy);
				ctx.lineTo(cx + r, cy);
				ctx.moveTo(cx, cy - r);
				ctx.lineTo(cx, cy + r);
				ctx.ellipse(cx, cy, r * .45, r, 0, 0, Math.PI * 2);
				break;
			}
			case "auth": {
				const r = s * .24;
				ctx.moveTo(cx, cy - r);
				ctx.lineTo(cx + r, cy - r * .55);
				ctx.lineTo(cx + r, cy + r * .25);
				ctx.quadraticCurveTo(cx + r, cy + r * .9, cx, cy + r);
				ctx.quadraticCurveTo(cx - r, cy + r * .9, cx - r, cy + r * .25);
				ctx.lineTo(cx - r, cy - r * .55);
				ctx.closePath();
				ctx.moveTo(cx - r * .4, cy);
				ctx.lineTo(cx - r * .1, cy + r * .32);
				ctx.lineTo(cx + r * .45, cy - r * .3);
				break;
			}
			case "function":
				ctx.font = `700 ${Math.round(s * .44)}px ${SANS}`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillStyle = color;
				ctx.fillText("λ", cx, cy + s * .02);
				return;
			case "git": {
				const r = s * .09;
				ctx.moveTo(cx - s * .16, cy - s * .18);
				ctx.arc(cx - s * .16, cy - s * .18, r, 0, Math.PI * 2);
				ctx.moveTo(cx - s * .16, cy - s * .18 + r);
				ctx.lineTo(cx - s * .16, cy + s * .12);
				ctx.arc(cx - s * .16, cy + s * .18, r, Math.PI, 0, true);
				ctx.quadraticCurveTo(cx, cy - s * .04, cx + s * .16, cy - s * .12 - r);
				ctx.moveTo(cx + s * .16, cy - s * .18);
				ctx.arc(cx + s * .16, cy - s * .18, r, 0, Math.PI * 2);
				break;
			}
		}
		ctx.stroke();
	}
	function drawDevNode(ctx, el) {
		const dev = el.dev in DEV_META ? el.dev : "server";
		const meta = DEV_META[dev];
		const { x, y, w, h } = el;
		ctx.save();
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, Math.min(12, h / 4));
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = meta.color;
		ctx.lineWidth = Math.max(2, h * .025);
		ctx.stroke();
		const inset = Math.max(6, h * .06);
		ctx.beginPath();
		ctx.roundRect(x + inset, y + inset, h - inset * 2, h - inset * 2, Math.min(10, h / 5));
		ctx.globalAlpha = .12;
		ctx.fillStyle = meta.color;
		ctx.fill();
		ctx.globalAlpha = 1;
		drawGlyph(ctx, dev, x + inset, y + inset, h - inset * 2, meta.color);
		const fs = el.fontSize ?? 26;
		const tx = x + h + 14;
		const tw = w - h - 26;
		if (tw > 0) {
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			const label = el.label ?? meta.name;
			if (el.sub) {
				ctx.font = `600 ${fs}px ${SANS}`;
				ctx.fillStyle = "#1F2937";
				ctx.fillText(label, tx, y + h / 2 - fs * .36, tw);
				ctx.font = `400 ${Math.round(fs * .72)}px ${SANS}`;
				ctx.fillStyle = "#64748B";
				ctx.fillText(el.sub, tx, y + h / 2 + fs * .52, tw);
			} else {
				ctx.font = `600 ${fs}px ${SANS}`;
				ctx.fillStyle = "#1F2937";
				ctx.fillText(label, tx, y + h / 2 + 1, tw);
			}
		}
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
	function drawConnector(ctx, el, elements = [], dashOffset) {
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
		if (dashOffset !== void 0) {
			ctx.setLineDash([lineW * 2.6, lineW * 1.9]);
			ctx.lineDashOffset = dashOffset;
		}
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
		ctx.setLineDash([]);
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
	function sourceSize$1(source) {
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
		const { w, h } = sourceSize$1(img.source);
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
	//#region src/core/render/actors.ts
	/**
	* 角色元素:头像(圆形图片/initials + 名称胶囊 + 状态点)与方块人(stand/point/think 三姿态)。
	* 纯 (project,t) 绘制,无外部状态;src 图片未就绪时回退 initials,不闪空。
	*/
	var INK$2 = "#1F2937";
	var MUTED$3 = "#64748B";
	var BLUE$1 = "#3B82F6";
	var STATUS_COLOR = {
		online: "#22C55E",
		busy: "#F59E0B",
		offline: "#94A3B8"
	};
	/** 斜向肢体:从 (x1,y1) 画到 (x2,y2) 的圆角矩形(竖/横/斜统一) */
	function drawLimb(ctx, x1, y1, x2, y2, w, r) {
		ctx.save();
		ctx.translate(x1, y1);
		ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
		roundRect(ctx, 0, -w / 2, Math.hypot(x2 - x1, y2 - y1), w, r);
		ctx.fill();
		ctx.restore();
	}
	/** 位图尺寸:主线程 HTMLImageElement(naturalWidth),Worker ImageBitmap(width) */
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
	function drawAvatar(ctx, el) {
		const d = Math.min(el.h, el.w * .5);
		const cx = el.x + d / 2;
		const cy = el.y + el.h / 2;
		const bg = el.color ?? BLUE$1;
		ctx.save();
		ctx.textBaseline = "middle";
		const img = el.src ? getImage(el.src) : null;
		if (img) {
			const { w, h } = sourceSize(img.source);
			ctx.save();
			ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
			ctx.clip();
			const s = Math.min(d / w, d / h);
			const dw = w * s;
			const dh = h * s;
			ctx.drawImage(img.source, cx - dw / 2, cy - dh / 2, dw, dh);
			ctx.restore();
		} else {
			const initials = (el.initials ?? (el.name ? el.name.charAt(0) : "?")) || "?";
			ctx.beginPath();
			ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
			ctx.fillStyle = bg;
			ctx.fill();
			ctx.font = sansFont(d * .42, 700);
			ctx.textAlign = "center";
			ctx.fillStyle = "#FFFFFF";
			ctx.fillText(initials, cx, cy);
		}
		if (el.status) {
			const a = Math.PI / 4;
			const sx = cx + Math.cos(a) * d * .42;
			const sy = cy + Math.sin(a) * d * .42;
			ctx.beginPath();
			ctx.arc(sx, sy, d * .13 + 3, 0, Math.PI * 2);
			ctx.fillStyle = "#FFFFFF";
			ctx.fill();
			ctx.beginPath();
			ctx.arc(sx, sy, d * .13, 0, Math.PI * 2);
			ctx.fillStyle = STATUS_COLOR[el.status];
			ctx.fill();
		}
		if (el.name) {
			ctx.font = sansFont(24, 500);
			const textW = ctx.measureText(el.name).width;
			const pillH = 30;
			const px = el.x + d + 8;
			roundRect(ctx, px, cy - pillH / 2, textW + 28, pillH, 15);
			ctx.fillStyle = "#FFFFFF";
			ctx.fill();
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = "#E2E8F0";
			ctx.stroke();
			ctx.textAlign = "left";
			ctx.fillStyle = INK$2;
			ctx.fillText(el.name, px + 14, cy);
		}
		ctx.restore();
	}
	function drawPerson(ctx, el) {
		const u = el.h;
		const cx = el.x + el.w / 2;
		const color = el.color ?? BLUE$1;
		const top = el.y;
		ctx.save();
		ctx.fillStyle = color;
		ctx.textBaseline = "middle";
		ctx.beginPath();
		ctx.arc(cx, top + u * .11, u * .11, 0, Math.PI * 2);
		ctx.fill();
		roundRect(ctx, cx - u * .13, top + u * .24, u * .26, u * .34, u * .08);
		ctx.fill();
		const legW = u * .09;
		for (const lx of [cx - u * .115, cx + u * .025]) {
			roundRect(ctx, lx, top + u * .58, legW, u * .3, u * .045);
			ctx.fill();
		}
		const armW = legW;
		const armR = u * .045;
		const shoulderY = top + u * .27;
		const armLen = u * .26;
		const leftX = cx - u * .13 - u * .02 - armW;
		drawLimb(ctx, leftX, shoulderY, leftX, shoulderY + armLen, armW, armR);
		const pose = el.pose ?? "stand";
		if (pose === "stand") drawLimb(ctx, cx + u * .15, shoulderY, cx + u * .15, shoulderY + armLen, armW, armR);
		else if (pose === "point") {
			const hx = cx + u * .13 + u * .3;
			drawLimb(ctx, cx + u * .13, shoulderY, hx, shoulderY, armW, armR);
			ctx.beginPath();
			ctx.arc(hx, shoulderY, u * .045, 0, Math.PI * 2);
			ctx.fill();
		} else {
			const ex = cx + u * .13;
			const ey = top + u * .38;
			const hx = cx + u * .18;
			const hy = top + u * .2;
			drawLimb(ctx, cx + u * .15, shoulderY, ex, ey, armW, armR);
			drawLimb(ctx, ex, ey, hx, hy, armW, armR);
			ctx.beginPath();
			ctx.arc(hx, hy, u * .045, 0, Math.PI * 2);
			ctx.fill();
			const bx = cx + u * .15;
			const by = top + u * .02;
			ctx.beginPath();
			ctx.arc(bx, by, u * .05, 0, Math.PI * 2);
			ctx.fillStyle = "#FFFFFF";
			ctx.fill();
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = "#CBD5E1";
			ctx.stroke();
			ctx.font = sansFont(u * .07, 700);
			ctx.textAlign = "center";
			ctx.fillStyle = MUTED$3;
			ctx.fillText("?", bx, by);
		}
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/charts.ts
	/**
	* 图表三件套:柱状 / 折线 / 饼图。数据驱动 + 确定性绘制;
	* 入场动画语义:柱 = 逐柱生长,线 = 沿路径 draw-on,饼 = 扫掠展开,progress 缺省 = 全显。
	*/
	var CHART_PALETTE = [
		"#3B82F6",
		"#F59E0B",
		"#10B981",
		"#EF4444",
		"#8B5CF6",
		"#EC4899"
	];
	var INK$1 = "#1F2937";
	var MUTED$2 = "#64748B";
	/** 数值上限取整放大:36 -> 40,170 -> 200,让柱顶/点不顶格 */
	function niceCeil(v) {
		if (v <= 0) return 1;
		const mag = Math.pow(10, Math.floor(Math.log10(v)));
		const n = v / mag;
		return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
	}
	function drawTitle(ctx, el, fontSize) {
		if (!el.title) return 0;
		ctx.font = sansFont(fontSize, 700);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = INK$1;
		ctx.fillText(el.title, el.x, el.y + fontSize * .9, el.w);
		return fontSize * 1.9;
	}
	function drawBarChart(ctx, el, progress) {
		const fontSize = el.fontSize ?? 28;
		const series = el.series ?? [];
		if (series.length === 0) return;
		const showValue = el.showValue !== false;
		const showAxis = el.axis !== false;
		const horizontal = el.horizontal === true;
		const pad = fontSize * .9;
		ctx.save();
		ctx.font = sansFont(fontSize * .72, 500);
		const titleH = drawTitle(ctx, el, fontSize);
		const area = {
			x: el.x + pad,
			y: el.y + titleH + pad * .5,
			w: el.w - pad * 2,
			h: el.h - titleH - pad * 1.5
		};
		const dataMax = Math.max(...series.map((s) => s.value), 0);
		const cap = Math.max(el.max ?? niceCeil(dataMax), dataMax, 1);
		const n = series.length;
		const slot = (horizontal ? area.h : area.w) / n;
		const barLong = horizontal ? area.w : area.h;
		ctx.textBaseline = "middle";
		series.forEach((s, i) => {
			const q = progress === void 0 ? 1 : Math.min(1, Math.max(0, progress * n - i));
			if (q <= 0) return;
			const e = 1 - Math.pow(1 - q, 3);
			const len = barLong * Math.min(1, Math.max(0, s.value / cap)) * e;
			const thick = slot * .56;
			ctx.fillStyle = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
			let labelX;
			let labelY;
			if (horizontal) {
				const by = area.y + i * slot + (slot - thick) / 2;
				roundRect(ctx, area.x, by, Math.max(len, 2), thick, thick / 2);
				ctx.fill();
				ctx.textAlign = "right";
				ctx.fillStyle = MUTED$2;
				ctx.fillText(s.label, area.x - fontSize * .4, by + thick / 2);
				labelX = area.x + len + fontSize * .35;
				labelY = by + thick / 2;
			} else {
				const bx = area.x + i * slot + (slot - thick) / 2;
				const by = area.y + area.h - len;
				roundRect(ctx, bx, by, thick, Math.max(len, 2), thick * .18);
				ctx.fill();
				ctx.textAlign = "center";
				ctx.fillStyle = MUTED$2;
				ctx.fillText(s.label, bx + thick / 2, area.y + area.h + fontSize * .75, slot);
				labelX = bx + thick / 2;
				labelY = by - fontSize * .6;
			}
			if (showValue) {
				ctx.textAlign = horizontal ? "left" : "center";
				ctx.fillStyle = INK$1;
				ctx.font = sansFont(fontSize * .72, 700);
				ctx.fillText(String(s.value), labelX, labelY);
				ctx.font = sansFont(fontSize * .72, 500);
			}
		});
		if (showAxis) {
			ctx.strokeStyle = "#CBD5E1";
			ctx.lineWidth = 2;
			ctx.beginPath();
			if (horizontal) {
				ctx.moveTo(area.x, area.y);
				ctx.lineTo(area.x, area.y + area.h);
			} else {
				ctx.moveTo(area.x, area.y + area.h);
				ctx.lineTo(area.x + area.w, area.y + area.h);
			}
			ctx.stroke();
		}
		ctx.restore();
	}
	function drawLineChart(ctx, el, progress) {
		const fontSize = el.fontSize ?? 26;
		const series = (el.series ?? []).slice(0, 3);
		if (series.length === 0) return;
		const pad = fontSize * .9;
		const allPts = series.flatMap((s) => s.points);
		if (allPts.length === 0) return;
		const dataMin = Math.min(...allPts);
		const dataMax = Math.max(...allPts);
		const span = Math.max(dataMax - dataMin, 1e-6);
		const lo = el.min ?? Math.floor(dataMin - span * .12);
		const hi = Math.max(el.max ?? Math.ceil(dataMax + span * .12), lo + 1e-6);
		const n = Math.max(...series.map((s) => s.points.length));
		ctx.save();
		const titleH = drawTitle(ctx, el, fontSize);
		const legendH = series.length > 1 ? fontSize * 1.6 : 0;
		const area = {
			x: el.x + pad,
			y: el.y + titleH + legendH + pad * .4,
			w: el.w - pad * 2,
			h: el.h - titleH - legendH - pad * 1.6
		};
		const X = (i) => area.x + (n <= 1 ? area.w / 2 : i / (n - 1) * area.w);
		const Y = (v) => area.y + area.h - (v - lo) / (hi - lo) * area.h;
		if (el.grid !== false) {
			ctx.font = sansFont(fontSize * .62, 500);
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			for (let g = 0; g <= 4; g++) {
				const gv = lo + (hi - lo) * g / 4;
				const gy = Y(gv);
				ctx.strokeStyle = "rgba(148,163,184,0.28)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(area.x, gy);
				ctx.lineTo(area.x + area.w, gy);
				ctx.stroke();
				ctx.fillStyle = MUTED$2;
				ctx.fillText(String(Math.round(gv)), el.x + fontSize * .1, gy);
			}
		}
		if (el.axis !== false) {
			ctx.strokeStyle = "#CBD5E1";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(area.x, area.y);
			ctx.lineTo(area.x, area.y + area.h);
			ctx.lineTo(area.x + area.w, area.y + area.h);
			ctx.stroke();
		}
		series.forEach((s, si) => {
			const pts = s.points.map((v, i) => ({
				x: X(i),
				y: Y(v)
			}));
			if (pts.length === 0) return;
			const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
			const segTotal = Math.max(pts.length - 1, 1);
			const f = progress === void 0 ? segTotal : Math.min(segTotal, Math.max(0, progress * segTotal));
			const full = Math.floor(f);
			const part = f - full;
			const drawn = pts.slice(0, full + 1);
			if (part > 0 && full + 1 < pts.length) {
				const a = pts[full];
				const b = pts[full + 1];
				drawn.push({
					x: a.x + (b.x - a.x) * part,
					y: a.y + (b.y - a.y) * part
				});
			}
			if (drawn.length === 0) return;
			if (el.area === true && drawn.length > 1) {
				ctx.beginPath();
				ctx.moveTo(drawn[0].x, area.y + area.h);
				drawn.forEach((p) => ctx.lineTo(p.x, p.y));
				ctx.lineTo(drawn[drawn.length - 1].x, area.y + area.h);
				ctx.closePath();
				ctx.fillStyle = color + "33";
				ctx.fill();
			}
			ctx.beginPath();
			ctx.strokeStyle = color;
			ctx.lineWidth = fontSize * .18;
			ctx.lineJoin = "round";
			ctx.lineCap = "round";
			if (el.smooth === true && drawn.length > 2) {
				ctx.moveTo((drawn[0].x + drawn[1].x) / 2, (drawn[0].y + drawn[1].y) / 2);
				for (let i = 1; i < drawn.length - 1; i++) {
					const mx = (drawn[i].x + drawn[i + 1].x) / 2;
					const my = (drawn[i].y + drawn[i + 1].y) / 2;
					ctx.quadraticCurveTo(drawn[i].x, drawn[i].y, mx, my);
				}
				ctx.lineTo(drawn[drawn.length - 1].x, drawn[drawn.length - 1].y);
			} else {
				ctx.moveTo(drawn[0].x, drawn[0].y);
				drawn.forEach((p) => ctx.lineTo(p.x, p.y));
			}
			ctx.stroke();
			if (el.dot !== false) {
				ctx.fillStyle = color;
				drawn.forEach((p) => {
					ctx.beginPath();
					ctx.arc(p.x, p.y, fontSize * .16, 0, Math.PI * 2);
					ctx.fill();
				});
			}
		});
		if (series.length > 1) {
			ctx.font = sansFont(fontSize * .68, 600);
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			let lx = area.x;
			const ly = el.y + titleH + fontSize * .8;
			series.forEach((s, si) => {
				ctx.fillStyle = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
				roundRect(ctx, lx, ly - fontSize * .22, fontSize * .44, fontSize * .44, fontSize * .12);
				ctx.fill();
				ctx.fillStyle = INK$1;
				ctx.fillText(s.label, lx + fontSize * .6, ly);
				lx += fontSize * .6 + ctx.measureText(s.label).width + fontSize * 1.1;
			});
		}
		ctx.restore();
	}
	function drawPieChart(ctx, el, progress) {
		const fontSize = el.fontSize ?? 26;
		const slices = (el.slices ?? []).filter((s) => s.value > 0);
		const total = slices.reduce((sum, s) => sum + s.value, 0);
		if (total <= 0) return;
		const legend = el.legend ?? "right";
		const pad = fontSize * .9;
		ctx.save();
		const titleH = drawTitle(ctx, el, fontSize);
		const legendW = legend === "right" ? el.w * .34 : 0;
		const legendH = legend === "bottom" ? fontSize * 1.7 : 0;
		const cx = el.x + (el.w - legendW) / 2;
		const cy = el.y + titleH + (el.h - titleH - legendH) / 2 + pad * .2;
		const r = Math.max(Math.min(el.w - legendW, el.h - titleH - legendH) / 2 - pad, fontSize);
		const start = (el.startAngle ?? -90) * Math.PI / 180;
		const sweep = (progress ?? 1) * Math.PI * 2;
		let acc = 0;
		slices.forEach((s, i) => {
			const a0 = start + acc / total * sweep;
			const a1 = start + (acc + s.value) / total * sweep;
			acc += s.value;
			if (a1 - a0 <= 0) return;
			const color = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
			ctx.beginPath();
			ctx.arc(cx, cy, r, a0, a1);
			if (el.donut === true) ctx.arc(cx, cy, r * .55, a1, a0, true);
			else ctx.lineTo(cx, cy);
			ctx.closePath();
			ctx.fillStyle = color;
			ctx.fill();
			ctx.strokeStyle = "#FFFFFF";
			ctx.lineWidth = 2.5;
			ctx.stroke();
		});
		if (el.donut === true) {
			ctx.font = sansFont(fontSize * .9, 700);
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillStyle = INK$1;
			ctx.fillText(String(Math.round(total)), cx, cy);
		}
		ctx.font = sansFont(fontSize * .68, 500);
		ctx.textBaseline = "middle";
		const drawLegend = (lx, ly, s, i) => {
			ctx.fillStyle = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
			roundRect(ctx, lx, ly - fontSize * .22, fontSize * .44, fontSize * .44, fontSize * .12);
			ctx.fill();
			ctx.textAlign = "left";
			ctx.fillStyle = INK$1;
			const pct = `${Math.round(s.value / total * 100)}%`;
			ctx.fillText(`${s.label}  ${pct}`, lx + fontSize * .62, ly, legend === "right" ? legendW - fontSize : el.w);
		};
		if (legend === "right") slices.forEach((s, i) => drawLegend(el.x + el.w - legendW + fontSize * .2, el.y + titleH + pad + i * fontSize * 1.35, s, i));
		else if (legend === "bottom") {
			const totalW = slices.reduce((sum, s) => sum + ctx.measureText(s.label).width + fontSize * 2.4, 0);
			let lx = el.x + (el.w - Math.min(totalW, el.w)) / 2;
			const ly = el.y + el.h - fontSize * .9;
			slices.forEach((s, i) => {
				drawLegend(lx, ly, s, i);
				lx += ctx.measureText(s.label).width + fontSize * 2.4;
			});
		}
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/guide.ts
	/**
	* 演示三件套:鼠标光标 / mac 文件树 / 行级代码 diff。确定性绘制,纯 (project, t) 函数;
	* 入场动画:文件树与 diff = 逐行 stagger(progress 缺省全显),光标移动由 localT 驱动。
	*/
	var INK = "#1F2937";
	var MUTED$1 = "#64748B";
	var BLUE = "#3B82F6";
	var clamp01 = (v) => Math.min(1, Math.max(0, v));
	/** 光标箭头多边形(以 tip 为原点,原始高约 22px) */
	var ARROW = [
		[0, 0],
		[0, 18],
		[5, 13],
		[10, 22],
		[14, 20],
		[14, 8]
	];
	/** localT 时刻的 tip 位置:points 折线均分时间窗逐段线性插值,p>=1 停在末点 */
	function cursorTipAt(el, localT) {
		const pts = el.points;
		if (pts.length === 0) return [el.x, el.y];
		if (pts.length === 1) return pts[0];
		const p = clamp01((localT - el.anim.start) / Math.max(el.anim.duration, 1e-6));
		if (p >= 1) return pts[pts.length - 1];
		const seg = pts.length - 1;
		const f = p * seg;
		const i = Math.min(Math.floor(f), seg - 1);
		const q = clamp01(f - i);
		const [ax, ay] = pts[i];
		const [bx, by] = pts[i + 1];
		return [ax + (bx - ax) * q, ay + (by - ay) * q];
	}
	function drawCursor(ctx, el, localT) {
		const s = Math.min(40, Math.max(16, el.h * .5)) / 22;
		for (const c of el.clicks ?? []) {
			const dt = localT - c;
			if (dt < 0 || dt > .5) continue;
			const [cx, cy] = cursorTipAt(el, c);
			ctx.save();
			ctx.globalAlpha = (1 - dt / .5) * .45;
			ctx.strokeStyle = BLUE;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(cx, cy, 6 + dt * 70, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}
		const [tx, ty] = cursorTipAt(el, localT);
		const holding = el.hold !== void 0 && localT >= el.hold[0] && localT <= el.hold[1];
		ctx.save();
		ctx.translate(tx, ty);
		if (holding) ctx.scale(.9, .9);
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.save();
		ctx.scale(s * 1.14, s * 1.14);
		ctx.beginPath();
		ctx.moveTo(ARROW[0][0], ARROW[0][1]);
		for (let i = 1; i < ARROW.length; i++) ctx.lineTo(ARROW[i][0], ARROW[i][1]);
		ctx.closePath();
		ctx.fillStyle = "#111827";
		ctx.fill();
		ctx.restore();
		ctx.scale(s, s);
		ctx.beginPath();
		ctx.moveTo(ARROW[0][0], ARROW[0][1]);
		for (let i = 1; i < ARROW.length; i++) ctx.lineTo(ARROW[i][0], ARROW[i][1]);
		ctx.closePath();
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = "#111827";
		ctx.lineWidth = 1.4;
		ctx.stroke();
		ctx.restore();
	}
	/** 小文件夹图标(填充 #FBBF24 简形):tab + 圆角主体 */
	function drawFolderIcon(ctx, x, y, w, h) {
		ctx.fillStyle = "#FBBF24";
		roundRect(ctx, x, y, w * .55, h * .5, h * .12);
		ctx.fill();
		roundRect(ctx, x, y + h * .2, w, h * .8, h * .14);
		ctx.fill();
	}
	/** 文档图标:白底 #CBD5E1 描边折角 */
	function drawFileIcon(ctx, x, y, w, h) {
		const fold = Math.min(w, h) * .32;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + w - fold, y);
		ctx.lineTo(x + w, y + fold);
		ctx.lineTo(x + w, y + h);
		ctx.lineTo(x, y + h);
		ctx.closePath();
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = "#CBD5E1";
		ctx.lineWidth = 1.5;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x + w - fold, y);
		ctx.lineTo(x + w - fold, y + fold);
		ctx.lineTo(x + w, y + fold);
		ctx.stroke();
	}
	function drawFolderTree(ctx, el, progress) {
		const fontSize = el.fontSize ?? 24;
		const lineH = fontSize * 1.7;
		const headerH = fontSize * 2;
		const pad = fontSize * .8;
		const n = el.items.length;
		const cardH = Math.max(el.h, headerH + n * lineH);
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, cardH, 14);
		ctx.clip();
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = "#E2E8F0";
		ctx.lineWidth = 1.5;
		roundRect(ctx, el.x, el.y, el.w, cardH, 14);
		ctx.stroke();
		ctx.fillStyle = "#F8FAFC";
		ctx.fillRect(el.x, el.y, el.w, headerH);
		ctx.strokeStyle = "#E2E8F0";
		ctx.beginPath();
		ctx.moveTo(el.x, el.y + headerH);
		ctx.lineTo(el.x + el.w, el.y + headerH);
		ctx.stroke();
		const iconS = fontSize * 1.05;
		drawFolderIcon(ctx, el.x + pad, el.y + (headerH - iconS * .8) / 2, iconS, iconS * .8);
		ctx.font = sansFont(fontSize * .72, 600);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = INK;
		ctx.fillText(el.root ?? "project", el.x + pad + iconS + fontSize * .4, el.y + headerH / 2);
		const depths = [];
		let prev = 0;
		el.items.forEach((item, i) => {
			prev = item.depth ?? (i === 0 ? 0 : prev);
			depths.push(prev);
		});
		el.items.forEach((item, i) => {
			const q = progress === void 0 ? 1 : clamp01(progress * n - i);
			if (q <= 0) return;
			ctx.save();
			ctx.globalAlpha *= q;
			const rowY = el.y + headerH + i * lineH + lineH / 2;
			const iconX = el.x + pad + depths[i] * fontSize * 1.4;
			if ((item.icon ?? "file") === "dir") drawFolderIcon(ctx, iconX, rowY - iconS / 2, iconS, iconS * .8);
			else drawFileIcon(ctx, iconX, rowY - iconS / 2, iconS * .8, iconS);
			const textX = iconX + iconS + fontSize * .45;
			ctx.font = sansFont(fontSize * .72, 600);
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillStyle = INK;
			ctx.fillText(item.name, textX, rowY);
			if (item.comment) {
				const nameW = ctx.measureText(item.name).width;
				ctx.font = sansFont(fontSize * .72, 500);
				ctx.fillStyle = MUTED$1;
				ctx.fillText("  // " + item.comment, textX + nameW, rowY);
			}
			ctx.restore();
		});
		ctx.restore();
	}
	function drawCodeDiff(ctx, el, progress) {
		const fontSize = el.fontSize ?? 24;
		const lineH = fontSize * 1.6;
		const headerH = fontSize * 2.1;
		const padX = fontSize * .9;
		const rows = [];
		for (const hunk of el.hunks) {
			if (hunk.ctx !== void 0) rows.push({
				tag: "ctx",
				text: hunk.ctx
			});
			for (const line of hunk.lines) rows.push({
				tag: line.tag,
				text: line.text
			});
		}
		const total = rows.length;
		const light = el.dark === false;
		const lineColor = light ? "#334155" : "#94A3B8";
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, 16);
		ctx.clip();
		ctx.fillStyle = light ? "#FFFFFF" : "#0F172A";
		ctx.fill();
		const dotR = fontSize * .22;
		const dotY = el.y + headerH / 2;
		drawWindowDots(ctx, el.x + fontSize, dotY, dotR);
		if (el.filename) {
			ctx.font = sansFont(fontSize * .82, 500);
			ctx.textAlign = "right";
			ctx.textBaseline = "middle";
			ctx.fillStyle = MUTED$1;
			ctx.fillText(el.filename, el.x + el.w - padX, dotY);
		}
		ctx.strokeStyle = light ? "#E2E8F0" : "#1E293B";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(el.x, el.y + headerH);
		ctx.lineTo(el.x + el.w, el.y + headerH);
		ctx.stroke();
		ctx.font = monoFont(fontSize);
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		let ly = el.y + headerH + lineH * .7;
		rows.forEach((row, i) => {
			const q = progress === void 0 ? 1 : clamp01(progress * total - i);
			if (q <= 0) {
				ly += lineH;
				return;
			}
			ctx.save();
			ctx.globalAlpha *= q;
			if (row.tag === "+") ctx.fillStyle = light ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.14)";
			else if (row.tag === "-") ctx.fillStyle = light ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.14)";
			if (row.tag === "+" || row.tag === "-") ctx.fillRect(el.x, ly - lineH / 2, el.w, lineH);
			if (row.tag === "ctx") ctx.fillStyle = MUTED$1;
			else if (row.tag === "+") ctx.fillStyle = light ? "#16A34A" : "#4ADE80";
			else if (row.tag === "-") ctx.fillStyle = light ? "#DC2626" : "#F87171";
			else ctx.fillStyle = lineColor;
			ctx.fillText(row.tag === "ctx" || row.tag === " " ? row.text : row.tag + " " + row.text, el.x + padX, ly);
			ctx.restore();
			ly += lineH;
		});
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/stage.ts
	/**
	* 舞台打底四件套:聚光暗角 / 网格背景 / 分组面板 / 泳道。
	* 全部是 (project, t) 纯函数,无动画语义;spotlight 用 evenodd 奇偶填充在暗色底板上挖孔。
	* 注:Node 测试环境无 Path2D,故暗角走默认路径(beginPath + 子路径)+ fill("evenodd"),与 Path2D 等价。
	*/
	var MUTED = "#64748B";
	var LANE_COLORS = [
		"#F8FAFC",
		"#F1F5F9",
		"#EEF2FF",
		"#ECFEFF"
	];
	/** 聚光灯:全屏暗角,只亮本元素几何区;孔 = 内切椭圆或圆角矩形(r=24) */
	function drawSpotlight(ctx, el) {
		const strength = el.strength ?? .65;
		ctx.save();
		ctx.fillStyle = `rgba(15,23,42,${strength})`;
		ctx.beginPath();
		ctx.rect(-32e3, -32e3, 64e3, 64e3);
		if (el.shape === "ellipse") ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
		else ctx.roundRect(el.x, el.y, el.w, el.h, 24);
		ctx.fill("evenodd");
		ctx.restore();
	}
	/** 把 rgba 的 alpha 提到 0.6 作轴线加重色;非 rgba 入参原样返回 */
	function deepenAxisColor(color) {
		const m = /^(.*,)\s*[\d.]+\)$/.exec(color);
		return m ? `${m[1]} 0.6)` : color;
	}
	/** 网格背景:坐标纸细线或点阵,从区域边缘按 step 布置;axis 时过中心的横竖线加重 */
	function drawGridBg(ctx, el) {
		const step = Math.max(el.step ?? 40, 12);
		const color = el.color ?? "rgba(148,163,184,0.35)";
		ctx.save();
		if (el.dot === true) {
			ctx.fillStyle = color;
			for (let gx = 0; gx <= el.w + .5; gx += step) for (let gy = 0; gy <= el.h + .5; gy += step) {
				ctx.beginPath();
				ctx.arc(el.x + gx, el.y + gy, 1.6, 0, Math.PI * 2);
				ctx.fill();
			}
		} else {
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let gx = 0; gx <= el.w + .5; gx += step) {
				ctx.moveTo(el.x + gx, el.y);
				ctx.lineTo(el.x + gx, el.y + el.h);
			}
			for (let gy = 0; gy <= el.h + .5; gy += step) {
				ctx.moveTo(el.x, el.y + gy);
				ctx.lineTo(el.x + el.w, el.y + gy);
			}
			ctx.stroke();
		}
		if (el.axis === true) {
			ctx.strokeStyle = deepenAxisColor(color);
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(el.x, el.y + el.h / 2);
			ctx.lineTo(el.x + el.w, el.y + el.h / 2);
			ctx.moveTo(el.x + el.w / 2, el.y);
			ctx.lineTo(el.x + el.w / 2, el.y + el.h);
			ctx.stroke();
		}
		ctx.restore();
	}
	/** 分组面板:圆角卡片 + 骑跨上边框的标题胶囊(纯视觉归拢,子元素仍绝对坐标) */
	function drawGroupPanel(ctx, el) {
		const radius = el.radius ?? 24;
		ctx.save();
		roundRect(ctx, el.x, el.y, el.w, el.h, radius);
		ctx.fillStyle = el.fill ?? "rgba(255,255,255,0.72)";
		ctx.fill();
		ctx.strokeStyle = el.stroke ?? "#E2E8F0";
		ctx.lineWidth = 1.5;
		ctx.stroke();
		if (el.title) {
			const fontSize = 22;
			const chipH = fontSize * 1.5;
			ctx.font = sansFont(fontSize, 600);
			ctx.textBaseline = "middle";
			const chipX = el.x + 28;
			const chipY = el.y - fontSize * .75;
			roundRect(ctx, chipX, chipY, ctx.measureText(el.title).width + fontSize * 1.2, chipH, fontSize * .75);
			ctx.fillStyle = el.accent ?? "#3B82F6";
			ctx.fill();
			ctx.textAlign = "left";
			ctx.fillStyle = "#FFFFFF";
			ctx.fillText(el.title, chipX + fontSize * .6, chipY + chipH / 2 + 1);
		}
		ctx.restore();
	}
	/** 泳道标签:带内白底 pill(高 30,宽 = 文本宽 + 24);h 方向靠带内左上,v 方向靠带顶部居中 */
	function drawLaneLabel(ctx, text, px, py) {
		ctx.font = sansFont(24, 500);
		roundRect(ctx, px, py, ctx.measureText(text).width + 24, 30, 15);
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.strokeStyle = "#E2E8F0";
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = MUTED;
		ctx.fillText(text, px + 12, py + 16);
	}
	/** 泳道:2-4 条平行色带 + 可选标签;count 缺省取 labels 长度,fallback 2(normalize 已钳 2-4) */
	function drawLane(ctx, el) {
		const count = el.count ?? el.labels?.length ?? 2;
		const gutter = el.gutter ?? 6;
		const horizontal = el.direction !== "v";
		const band = (horizontal ? el.h - (count - 1) * gutter : el.w - (count - 1) * gutter) / count;
		ctx.save();
		for (let i = 0; i < count; i++) {
			const bx = horizontal ? el.x : el.x + i * (band + gutter);
			const by = horizontal ? el.y + i * (band + gutter) : el.y;
			const bw = horizontal ? el.w : band;
			const bh = horizontal ? band : el.h;
			ctx.fillStyle = LANE_COLORS[i % LANE_COLORS.length];
			ctx.fillRect(bx, by, bw, bh);
			ctx.font = sansFont(24, 500);
			const label = el.labels?.[i];
			if (label) drawLaneLabel(ctx, label, horizontal ? bx + 10 : bx + (bw - (ctx.measureText(label).width + 24)) / 2, by + 8);
			if (i === count - 1) continue;
			ctx.strokeStyle = "#E2E8F0";
			ctx.lineWidth = 1;
			ctx.setLineDash([6, 6]);
			ctx.beginPath();
			if (horizontal) {
				const gy = by + bh + gutter / 2;
				ctx.moveTo(el.x, gy);
				ctx.lineTo(el.x + el.w, gy);
			} else {
				const gx = bx + bw + gutter / 2;
				ctx.moveTo(gx, el.y);
				ctx.lineTo(gx, el.y + el.h);
			}
			ctx.stroke();
			ctx.setLineDash([]);
		}
		ctx.restore();
	}
	//#endregion
	//#region src/core/render/rich.ts
	/** 富文本补强:引用块 + 数学公式(TeX 子集轻量排版,零依赖)。 */
	function drawQuote(ctx, el, progress) {
		const fontSize = el.fontSize ?? 34;
		const accent = el.accent ?? "#3B82F6";
		const authorH = el.author ? fontSize * 1.5 : 0;
		ctx.save();
		roundRect(ctx, el.x, el.y + fontSize * .2, 6, el.h - fontSize * .4 - authorH, 3);
		ctx.fillStyle = accent;
		ctx.fill();
		drawRichText(ctx, el.x + fontSize * .9, el.y, el.w - fontSize, el.h - authorH, el.text, {
			fontSize,
			color: "#1F2937",
			align: "left",
			progress
		});
		if (el.author) {
			ctx.font = sansFont(fontSize * .78, 500);
			ctx.textAlign = "right";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "#64748B";
			ctx.fillText(`—— ${el.author}`, el.x + el.w, el.y + el.h - fontSize * .75, el.w);
		}
		ctx.restore();
	}
	/** 命令映射:希腊字母 / 关系与运算 / 大型算子(左值 = TeX 命令名,不含反斜杠) */
	var TEX_SYMBOLS = {
		alpha: "α",
		beta: "β",
		gamma: "γ",
		delta: "δ",
		epsilon: "ε",
		zeta: "ζ",
		eta: "η",
		theta: "θ",
		lambda: "λ",
		mu: "μ",
		xi: "ξ",
		pi: "π",
		rho: "ρ",
		sigma: "σ",
		tau: "τ",
		phi: "φ",
		chi: "χ",
		psi: "ψ",
		omega: "ω",
		Gamma: "Γ",
		Delta: "Δ",
		Theta: "Θ",
		Lambda: "Λ",
		Pi: "Π",
		Sigma: "Σ",
		Phi: "Φ",
		Omega: "Ω",
		sum: "∑",
		int: "∫",
		infty: "∞",
		pm: "±",
		mp: "∓",
		times: "×",
		div: "÷",
		cdot: "⋅",
		leq: "≤",
		geq: "≥",
		neq: "≠",
		approx: "≈",
		propto: "∝",
		rightarrow: "→",
		leftarrow: "←",
		Rightarrow: "⇒",
		mapsto: "↦",
		partial: "∂",
		nabla: "∇",
		forall: "∀",
		exists: "∃",
		in: "∈",
		subset: "⊂",
		cup: "∪",
		cap: "∩",
		ldots: "…",
		cdots: "⋯",
		quad: " ",
		qquad: "  "
	};
	var TexError = class extends Error {};
	/** 递归下降解析:frac/sqrt 命令、^ _ 上下标(绑定前驱)、{} 分组;未闭合抛出由绘制层回落纯文本 */
	function parseTex(src) {
		let pos = 0;
		const peek = () => src[pos];
		const eat = () => src[pos++];
		function parseGroup() {
			if (peek() === "{") {
				eat();
				const g = parseSeq();
				if (peek() !== "}") throw new TexError("未闭合的 {");
				eat();
				return g;
			}
			if (pos >= src.length) throw new TexError("下标/上标缺操作数");
			const ch = eat();
			if (ch === "\\") {
				const name = readCommand();
				return {
					t: "op",
					sym: TEX_SYMBOLS[name] ?? name
				};
			}
			return {
				t: "chr",
				ch
			};
		}
		function readCommand() {
			const m = /^[a-zA-Z]+/.exec(src.slice(pos));
			if (m) {
				pos += m[0].length;
				return m[0];
			}
			return pos < src.length ? eat() : "";
		}
		function parseSeq() {
			const children = [];
			while (pos < src.length && peek() !== "}") {
				const ch = eat();
				if (ch === "\\") {
					const name = readCommand();
					if (name === "frac") children.push({
						t: "frac",
						num: parseGroup(),
						den: parseGroup()
					});
					else if (name === "sqrt") children.push({
						t: "sqrt",
						arg: parseGroup()
					});
					else children.push({
						t: "op",
						sym: TEX_SYMBOLS[name] ?? name
					});
				} else if (ch === "_" || ch === "^") {
					const prev = children.pop();
					if (!prev) throw new TexError("下标/上标缺前驱");
					const arg = parseGroup();
					children.push(ch === "_" ? {
						t: "sub",
						base: prev,
						arg
					} : {
						t: "sup",
						base: prev,
						arg
					});
				} else if (ch === "{") {
					children.push(parseSeq());
					if (peek() !== "}") throw new TexError("未闭合的 {");
					eat();
				} else children.push({
					t: "chr",
					ch
				});
			}
			return {
				t: "seq",
				children
			};
		}
		const root = parseSeq();
		if (pos !== src.length) throw new TexError("多余的 }");
		return root;
	}
	function mathFont(size) {
		return `italic 600 ${size}px Georgia,"Times New Roman","Songti SC",serif`;
	}
	function measure(ctx, node, size) {
		const script = size * .66;
		ctx.font = mathFont(size);
		switch (node.t) {
			case "chr":
			case "op": {
				const ch = node.t === "chr" ? node.ch : node.sym;
				return {
					w: ctx.measureText(ch).width,
					up: size * .74,
					down: size * .26
				};
			}
			case "seq": {
				let w = 0;
				let up = size * .2;
				let down = 0;
				for (const c of node.children) {
					const m = measure(ctx, c, size);
					w += m.w;
					up = Math.max(up, m.up);
					down = Math.max(down, m.down);
				}
				return {
					w,
					up,
					down
				};
			}
			case "frac": {
				const nm = measure(ctx, node.num, script);
				const dm = measure(ctx, node.den, script);
				return {
					w: Math.max(nm.w, dm.w) + size * .28,
					up: nm.up + nm.down + size * .34,
					down: dm.up + dm.down + size * .22
				};
			}
			case "sqrt": {
				const am = measure(ctx, node.arg, size);
				return {
					w: am.w + size * .5,
					up: am.up + size * .12,
					down: am.down
				};
			}
			case "sup":
			case "sub": {
				const bm = measure(ctx, node.base, size);
				const am = measure(ctx, node.arg, script);
				return node.t === "sup" ? {
					w: bm.w + am.w,
					up: bm.up + am.up * .85,
					down: bm.down
				} : {
					w: bm.w + am.w,
					up: bm.up,
					down: bm.down + am.down + size * .08
				};
			}
		}
	}
	function renderAt(ctx, node, x, baseY, size) {
		const script = size * .66;
		ctx.font = mathFont(size);
		switch (node.t) {
			case "chr":
			case "op": {
				const ch = node.t === "chr" ? node.ch : node.sym;
				ctx.textAlign = "left";
				ctx.textBaseline = "alphabetic";
				ctx.fillText(ch, x, baseY);
				return ctx.measureText(ch).width;
			}
			case "seq": {
				let cx = x;
				for (const c of node.children) cx += renderAt(ctx, c, cx, baseY, size);
				return cx - x;
			}
			case "frac": {
				const nm = measure(ctx, node.num, script);
				const dm = measure(ctx, node.den, script);
				const w = Math.max(nm.w, dm.w) + size * .28;
				const ruleY = baseY - size * .1;
				renderAt(ctx, node.num, x + (w - nm.w) / 2, ruleY - size * .14, script);
				renderAt(ctx, node.den, x + (w - dm.w) / 2, ruleY + dm.up + size * .14, script);
				ctx.strokeStyle = ctx.fillStyle;
				ctx.lineWidth = Math.max(1, size * .045);
				ctx.beginPath();
				ctx.moveTo(x + size * .05, ruleY);
				ctx.lineTo(x + w - size * .05, ruleY);
				ctx.stroke();
				return w;
			}
			case "sqrt": {
				const am = measure(ctx, node.arg, size);
				const signW = size * .42;
				const topY = baseY - am.up - size * .08;
				ctx.strokeStyle = ctx.fillStyle;
				ctx.lineWidth = Math.max(1, size * .05);
				ctx.lineJoin = "round";
				ctx.beginPath();
				ctx.moveTo(x, baseY - size * .08);
				ctx.lineTo(x + signW * .32, baseY - size * .08);
				ctx.lineTo(x + signW * .6, topY + size * .04);
				ctx.lineTo(x + signW, topY);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(x + signW, topY);
				ctx.lineTo(x + signW + am.w + size * .08, topY);
				ctx.stroke();
				renderAt(ctx, node.arg, x + signW + size * .04, baseY, size);
				return signW + am.w + size * .12;
			}
			case "sup":
			case "sub": {
				const bm = measure(ctx, node.base, size);
				const am = measure(ctx, node.arg, script);
				renderAt(ctx, node.base, x, baseY, size);
				const argBase = node.t === "sup" ? baseY - bm.up * .85 - am.down * .2 : baseY + bm.down + am.up * .85;
				renderAt(ctx, node.arg, x + bm.w, argBase, script);
				return bm.w + am.w;
			}
		}
	}
	function drawFormula(ctx, el) {
		const color = el.color ?? "#1F2937";
		let root = null;
		try {
			root = parseTex(el.text);
		} catch {
			root = null;
		}
		ctx.save();
		ctx.fillStyle = color;
		if (!root) {
			ctx.font = sansFont(el.fontSize ?? 44, 600);
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(el.text, el.x + el.w / 2, el.y + el.h / 2, el.w);
			ctx.restore();
			return;
		}
		let size = el.fontSize ?? 64;
		let m = measure(ctx, root, size);
		const scale = Math.min(el.w / Math.max(m.w, 1e-6), el.h / Math.max(m.up + m.down, 1e-6), 1);
		if (scale < 1) {
			size *= scale;
			m = measure(ctx, root, size);
		}
		renderAt(ctx, root, el.x + (el.w - m.w) / 2, el.y + (el.h - (m.up + m.down)) / 2 + m.up, size);
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
		const barH = Math.max(6, Math.min(fontSize * 1.35, el.label !== void 0 ? el.h - fontSize * 2.1 : el.h));
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
		const elT = applyTweens(el, localT);
		const st = animState(localT, elT.anim);
		if (!st.active) return;
		const exit = elT.exit ? exitState(localT, elT.exit) : null;
		if (exit?.phase === "gone") return;
		const visual = animVisual(elT.anim, st.p);
		let alpha = visual.alpha;
		let dx = visual.dx;
		let dy = visual.dy;
		let scale = visual.scale;
		let wipeWidth = visual.wipeWidth;
		if (exit && exit.phase === "out" && elT.exit) {
			const ev = exitVisual(elT.exit, exit.q);
			alpha *= ev.alpha;
			dx += ev.dx;
			dy += ev.dy;
			scale *= ev.scale;
			if (ev.wipeWidth !== null) wipeWidth = ev.wipeWidth;
		}
		const fx = emphasisFx(localT, elT.emphasis);
		ctx.save();
		ctx.globalAlpha *= alpha;
		const tx = dx + fx.dx;
		const ty = dy + fx.dy;
		if (tx !== 0 || ty !== 0) ctx.translate(tx, ty);
		const totalScale = scale * fx.scaleMul;
		if (totalScale !== 1 || visual.rotation !== 0) {
			const cx = elT.x + elT.w / 2;
			const cy = elT.y + elT.h / 2;
			ctx.translate(cx, cy);
			if (visual.rotation !== 0) ctx.rotate(visual.rotation);
			if (totalScale !== 1) ctx.scale(totalScale, totalScale);
			ctx.translate(-cx, -cy);
		}
		const rotateDeg = elT.kind === "connector" ? 0 : elT.rotate ?? (elT.kind === "note" ? -2 : 0);
		if (rotateDeg !== 0) {
			const rx = elT.x + elT.w / 2;
			const ry = elT.y + elT.h / 2;
			ctx.translate(rx, ry);
			ctx.rotate(rotateDeg * Math.PI / 180);
			ctx.translate(-rx, -ry);
		}
		if (fx.glow > 0) {
			ctx.shadowColor = "#93C5FD";
			ctx.shadowBlur = fx.glow;
		}
		if (wipeWidth !== null) {
			ctx.beginPath();
			ctx.rect(elT.x - 4, elT.y - 4, elT.w * wipeWidth + 8, elT.h + 8);
			ctx.clip();
		}
		const progress = visual.progress;
		switch (elT.kind) {
			case "title":
				drawTitle$1(ctx, elT, progress);
				break;
			case "artText":
				drawArtText(ctx, elT, progress);
				break;
			case "shape":
				drawShape(ctx, elT);
				break;
			case "text":
				drawText(ctx, elT, progress);
				break;
			case "input":
				drawInput(ctx, elT);
				break;
			case "note":
				drawNote(ctx, elT, progress);
				break;
			case "badge":
				drawBadge(ctx, elT);
				break;
			case "code":
				drawCode(ctx, elT, progress, fx.highlightLines);
				break;
			case "table":
				drawTable(ctx, elT, progress);
				break;
			case "arrayCells":
				drawArrayCells(ctx, elT);
				break;
			case "connector":
				drawConnector(ctx, resolveConnector(elT, sceneElements), sceneElements, fx.dashFlow !== null ? -localT * fx.dashFlow : void 0);
				break;
			case "image":
				drawImageEl(ctx, elT);
				break;
			case "list":
				drawList(ctx, elT, progress);
				break;
			case "stepCard":
				drawStepCard(ctx, elT, progress);
				break;
			case "terminal":
				drawTerminal(ctx, elT, progress, fx.highlightLines);
				break;
			case "progress":
				drawProgress(ctx, elT);
				break;
			case "kbd":
				drawKbd(ctx, elT);
				break;
			case "browser":
				drawBrowser(ctx, elT);
				break;
			case "devNode":
				drawDevNode(ctx, elT);
				break;
			case "phone":
				drawPhone(ctx, elT);
				break;
			case "aiChat":
				drawAiChat(ctx, elT, progress);
				break;
			case "barChart":
				drawBarChart(ctx, elT, progress);
				break;
			case "lineChart":
				drawLineChart(ctx, elT, progress);
				break;
			case "pieChart":
				drawPieChart(ctx, elT, progress);
				break;
			case "cursor":
				drawCursor(ctx, elT, localT);
				break;
			case "folderTree":
				drawFolderTree(ctx, elT, progress);
				break;
			case "codeDiff":
				drawCodeDiff(ctx, elT, progress);
				break;
			case "spotlight":
				drawSpotlight(ctx, elT);
				break;
			case "gridBg":
				drawGridBg(ctx, elT);
				break;
			case "groupPanel":
				drawGroupPanel(ctx, elT);
				break;
			case "lane":
				drawLane(ctx, elT);
				break;
			case "quote":
				drawQuote(ctx, elT, progress);
				break;
			case "formula":
				drawFormula(ctx, elT);
				break;
			case "avatar":
				drawAvatar(ctx, elT);
				break;
			case "person": drawPerson(ctx, elT);
		}
		if (fx.flashAlpha > 0) {
			ctx.globalAlpha = fx.flashAlpha;
			ctx.fillStyle = "#FFFFFF";
			ctx.fillRect(elT.x, elT.y, elT.w, elT.h);
		}
		if (fx.ringQ !== null) {
			ctx.globalAlpha = (1 - fx.ringQ) * .55;
			ctx.strokeStyle = "#3B82F6";
			ctx.lineWidth = 5;
			ctx.beginPath();
			ctx.arc(elT.x + elT.w / 2, elT.y + elT.h / 2, Math.max(elT.w, elT.h) / 2 * (.35 + .85 * fx.ringQ), 0, Math.PI * 2);
			ctx.stroke();
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

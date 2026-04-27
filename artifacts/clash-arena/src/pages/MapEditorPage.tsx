import { useState, useEffect, useRef, useCallback } from "react";
import {
  isAdminUnlocked, tryAdminLogin, lockAdmin,
  getSavedMaps, upsertMap, deleteMapById,
  getPublishedMap, publishMap,
  validateMap, generateRandomMap,
  EDITOR_MODES, OV,
  type MapSave, type EditorMode, type OVType,
} from "../utils/mapEditorAPI";
import { getTileCanvas, loadAllTileModels } from "../utils/tileModelCache";
import { getPlatformTileCanvas, loadPlatformTile } from "../utils/platformTile";
import { getPowerBoxCanvas, getSafeCanvas, loadPowerModels } from "../utils/powerModelCache";

const GS = 60;
const IDX = (x: number, y: number) => y * GS + x;

// ── Tile palette definition ───────────────────────────────────────────────────
// Note: type 0 (grass/ground) is NOT in the palette — it's the default background.
// Use the Erase tool to return a cell to ground.
const TILE_DEFS = [
  { type: 1,  label: "Стена",      color: "#8B6060", icon: "🧱", desc: "Непроходимая" },
  { type: 2,  label: "Гора",       color: "#607060", icon: "⛰️", desc: "Непроходимая" },
  { type: 3,  label: "Куст",       color: "#4CAF50", icon: "🌳", desc: "Укрытие" },
  { type: 4,  label: "Вода",       color: "#1565C0", icon: "💧", desc: "Замедление" },
  { type: 5,  label: "Кости",      color: "#BDBDBD", icon: "💀", desc: "Разрушаемый" },
  { type: 6,  label: "Забор",      color: "#C8A45A", icon: "🔩", desc: "Просматривается" },
  { type: 7,  label: "Бочка",      color: "#C2185B", icon: "❤️", desc: "Лечение" },
  { type: 9,  label: "Кактус",     color: "#558B2F", icon: "🌵", desc: "Непроходимый" },
  { type: 10, label: "Дерево",     color: "#8D6E63", icon: "🪵", desc: "Непроходимый" },
  { type: 11, label: "Камень",     color: "#78909C", icon: "🪨", desc: "Непроходимый" },
  { type: 12, label: "Пирамида",   color: "#FDD835", icon: "🔺", desc: "Непроходимая" },
] as const;

// All possible overlay markers
const ALL_OVERLAY_DEFS: { ov: OVType; label: string; color: string; icon: string }[] = [
  { ov: OV.SPAWN_SD,   label: "Спавн SD",      color: "#FF9800", icon: "🔶" },
  { ov: OV.SPAWN_BLUE, label: "Спавн синих",   color: "#1976D2", icon: "🔵" },
  { ov: OV.SPAWN_RED,  label: "Спавн красных", color: "#D32F2F", icon: "🔴" },
  { ov: OV.GEM_CENTER, label: "Центр кристалл",color: "#9C27B0", icon: "💎" },
  { ov: OV.SAFE_BLUE,  label: "Сейф синих",    color: "#0288D1", icon: "🔐" },
  { ov: OV.SAFE_RED,   label: "Сейф красных",  color: "#C62828", icon: "🔐" },
  { ov: OV.BASE_BLUE,  label: "База синих",     color: "#0277BD", icon: "🏰" },
  { ov: OV.BASE_RED,   label: "База красных",   color: "#B71C1C", icon: "🏰" },
  { ov: OV.GOAL_BLUE,  label: "Ворота синих",   color: "#0288D1", icon: "⚽" },
  { ov: OV.GOAL_RED,   label: "Ворота красных", color: "#C62828", icon: "⚽" },
  { ov: OV.POWER_BOX,  label: "Бокс усиления",  color: "#7B2FBE", icon: "📦" },
];

// Which overlays are valid for each mode
const MODE_OVERLAYS: Record<EditorMode, OVType[]> = {
  showdown:  [OV.SPAWN_SD, OV.POWER_BOX],
  gemgrab:   [OV.SPAWN_BLUE, OV.SPAWN_RED, OV.GEM_CENTER],
  heist:     [OV.SPAWN_BLUE, OV.SPAWN_RED, OV.SAFE_BLUE, OV.SAFE_RED],
  bounty:    [OV.SPAWN_BLUE, OV.SPAWN_RED],
  brawlball: [OV.SPAWN_BLUE, OV.SPAWN_RED, OV.GOAL_BLUE, OV.GOAL_RED],
  siege:     [OV.SPAWN_BLUE, OV.SPAWN_RED, OV.BASE_BLUE, OV.BASE_RED],
};

type Tool = "pan" | "place" | "erase" | "brush" | "fill_rect";
type Mirror = "none" | "h" | "v" | "both";

interface Selection { x0: number; y0: number; x1: number; y1: number }

// ── Admin Login modal ─────────────────────────────────────────────────────────
function AdminLoginModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (tryAdminLogin(login, pass)) onSuccess();
    else setErr("Неверный логин или пароль");
  };
  return (
    <Overlay>
      <ModalBox title="Вход для администратора">
        <input
          placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Пароль" type="password" value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{ ...inputStyle, marginTop: 10 }}
        />
        {err && <div style={{ color: "#F44336", fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Btn color="#FF5252" onClick={onCancel}>Отмена</Btn>
          <Btn color="#69F0AE" onClick={submit}>Войти</Btn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Mode Select modal ─────────────────────────────────────────────────────────
function ModeSelectModal({ onSelect }: { onSelect: (m: EditorMode) => void }) {
  return (
    <Overlay>
      <ModalBox title="Выберите режим карты">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {EDITOR_MODES.map(m => (
            <button key={m.id} onClick={() => onSelect(m.id)} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12, padding: "16px 12px", color: "white", cursor: "pointer",
              textAlign: "center", fontFamily: "inherit", transition: "background 0.15s",
            }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              <div style={{ fontSize: 28 }}>{m.icon}</div>
              <div style={{ marginTop: 6, fontWeight: 800, fontSize: 13 }}>{m.label}</div>
            </button>
          ))}
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Save modal ────────────────────────────────────────────────────────────────
function SaveModal({ defaultName, onSave, onCancel }: { defaultName: string; onSave: (n: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <Overlay>
      <ModalBox title="Сохранить карту">
        <input
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onSave(name.trim())}
          placeholder="Название карты" style={inputStyle} autoFocus
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn color="#FF5252" onClick={onCancel}>Отмена</Btn>
          <Btn color="#69F0AE" onClick={() => name.trim() && onSave(name.trim())}>Сохранить</Btn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Maps library modal ────────────────────────────────────────────────────────
function MapsModal({
  maps, currentMode, onLoad, onDelete, onPublish, onClose,
}: {
  maps: MapSave[]; currentMode: EditorMode;
  onLoad: (m: MapSave) => void; onDelete: (id: string) => void;
  onPublish: (m: MapSave) => void; onClose: () => void;
}) {
  const published = getPublishedMap(currentMode);
  return (
    <Overlay>
      <ModalBox title="Сохранённые карты" wide>
        {maps.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 24 }}>
            Нет сохранённых карт
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
          {maps.map(m => (
            <div key={m.id} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {EDITOR_MODES.find(x => x.id === m.mode)?.label ?? m.mode} • {new Date(m.updatedAt).toLocaleDateString("ru-RU")}
                  {published?.id === m.id && <span style={{ color: "#69F0AE", marginLeft: 8 }}>✓ Опубликована</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <SmBtn color="#40C4FF" onClick={() => onLoad(m)}>Открыть</SmBtn>
                {m.mode === currentMode && (
                  <SmBtn color="#FFD54F" onClick={() => onPublish(m)}>Опубликовать</SmBtn>
                )}
                <SmBtn color="#FF5252" onClick={() => { if (confirm(`Удалить «${m.name}»?`)) onDelete(m.id); }}>Удалить</SmBtn>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Btn color="rgba(255,255,255,0.3)" onClick={onClose}>Закрыть</Btn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Validation Result modal ───────────────────────────────────────────────────
function ValidationModal({ errors, onClose, onForce }: { errors: string[]; onClose: () => void; onForce?: () => void }) {
  return (
    <Overlay>
      <ModalBox title={errors.length === 0 ? "Карта корректна ✓" : "Ошибки валидации"}>
        {errors.length === 0 ? (
          <div style={{ color: "#69F0AE", fontWeight: 700 }}>Карта прошла все проверки!</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            {errors.map((e, i) => <li key={i} style={{ color: "#F44336", fontSize: 13 }}>{e}</li>)}
          </ul>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn color="rgba(255,255,255,0.3)" onClick={onClose}>Закрыть</Btn>
          {errors.length > 0 && onForce && (
            <Btn color="#FF9800" onClick={onForce}>Опубликовать всё равно</Btn>
          )}
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Main MapEditorPage ────────────────────────────────────────────────────────
interface Props { onBack: () => void }

export default function MapEditorPage({ onBack }: Props) {
  const [authed, setAuthed] = useState(isAdminUnlocked());
  const [showLogin, setShowLogin] = useState(!isAdminUnlocked());

  // Redirect to login if not authed
  if (!authed && !showLogin) return null;
  if (showLogin && !authed) {
    return <AdminLoginModal
      onSuccess={() => { setAuthed(true); setShowLogin(false); }}
      onCancel={onBack}
    />;
  }

  return <EditorCore onBack={onBack} />;
}

// ── Editor core (only rendered when authed) ───────────────────────────────────
function EditorCore({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Grid state
  const [mode, setMode] = useState<EditorMode | null>(null);
  const cells   = useRef<number[]>(new Array(GS * GS).fill(0));
  const overlays = useRef<number[]>(new Array(GS * GS).fill(0));
  const [, forceRedraw] = useState(0);
  const redraw = useCallback(() => forceRedraw(n => n + 1), []);

  // Camera
  const camX = useRef(0);   // world px
  const camY = useRef(0);
  const zoom = useRef(14);  // px per cell (6–36)

  // Tools
  const [tool, setTool] = useState<Tool>("pan");
  const [mirror, setMirror] = useState<Mirror>("none");
  const [selectedTile, setSelectedTile] = useState<number>(0);   // 0 = none selected
  const [selectedOv, setSelectedOv]   = useState<OVType | 0>(0); // 0 = not using overlay

  // 3D model assets
  const [modelsReady, setModelsReady] = useState(false);
  useEffect(() => {
    Promise.all([loadAllTileModels(), loadPlatformTile(), loadPowerModels()]).then(() => {
      setModelsReady(true);
    });
  }, []);
  // Re-render whenever models finish loading
  useEffect(() => { if (modelsReady) redraw(); }, [modelsReady]);

  // Interaction state
  const isPanning = useRef(false);
  const isDrawing = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const fillStart = useRef<{ x: number; y: number } | null>(null);
  const [fillSel, setFillSel] = useState<Selection | null>(null);
  const brushLastCell = useRef<{ x: number; y: number } | null>(null);

  // Modals
  const [showMaps, setShowMaps]       = useState(false);
  const [showSave, setShowSave]       = useState(false);
  const [saveName, setSaveName]       = useState("Моя карта");
  const [currentId, setCurrentId]     = useState<string | null>(null);
  const [notification, setNotif]      = useState("");
  const [valResult, setValResult]     = useState<{ errors: string[]; action?: () => void } | null>(null);
  const [maps, setMaps]               = useState<MapSave[]>([]);

  const notify = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(""), 3000); };

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  const screenToGrid = (sx: number, sy: number): { gx: number; gy: number } => ({
    gx: Math.floor((sx + camX.current) / zoom.current),
    gy: Math.floor((sy + camY.current) / zoom.current),
  });

  const clampCam = () => {
    const cs = zoom.current;
    const maxX = GS * cs - (canvasRef.current?.width ?? 800);
    const maxY = GS * cs - (canvasRef.current?.height ?? 600);
    camX.current = Math.max(0, Math.min(camX.current, Math.max(0, maxX)));
    camY.current = Math.max(0, Math.min(camY.current, Math.max(0, maxY)));
  };

  // ── Mirror helper ───────────────────────────────────────────────────────────
  const mirrorCells = (gx: number, gy: number): [number, number][] => {
    const pts: [number, number][] = [[gx, gy]];
    if (mirror === "h" || mirror === "both") pts.push([GS - 1 - gx, gy]);
    if (mirror === "v" || mirror === "both") pts.push([gx, GS - 1 - gy]);
    if (mirror === "both") pts.push([GS - 1 - gx, GS - 1 - gy]);
    return [...new Map(pts.map(p => [p[0] * 1000 + p[1], p])).values()];
  };

  // ── Place / erase at cell ───────────────────────────────────────────────────
  const applyToCell = useCallback((gx: number, gy: number, t: Tool) => {
    if (gx < 0 || gy < 0 || gx >= GS || gy >= GS) return;
    const pts = mirrorCells(gx, gy);
    pts.forEach(([x, y]) => {
      if (t === "erase") {
        cells.current[IDX(x, y)]    = 0;
        overlays.current[IDX(x, y)] = 0;
      } else {
        if (selectedOv !== 0) {
          overlays.current[IDX(x, y)] = selectedOv;
          cells.current[IDX(x, y)] = 0;  // overlays sit on grass
        } else {
          cells.current[IDX(x, y)]    = selectedTile;
          overlays.current[IDX(x, y)] = 0;
        }
      }
    });
    redraw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTile, selectedOv, mirror]);

  // Fill rectangle
  const applyFillRect = useCallback((sel: Selection) => {
    const x0 = Math.min(sel.x0, sel.x1), x1 = Math.max(sel.x0, sel.x1);
    const y0 = Math.min(sel.y0, sel.y1), y1 = Math.max(sel.y0, sel.y1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (selectedOv !== 0) {
          overlays.current[IDX(x, y)] = selectedOv;
          cells.current[IDX(x, y)] = 0;
        } else {
          cells.current[IDX(x, y)] = selectedTile;
          overlays.current[IDX(x, y)] = 0;
        }
        if (mirror !== "none") {
          mirrorCells(x, y).forEach(([mx, my]) => {
            if (mx === x && my === y) return;
            if (selectedOv !== 0) { overlays.current[IDX(mx,my)] = selectedOv; cells.current[IDX(mx,my)] = 0; }
            else { cells.current[IDX(mx,my)] = selectedTile; overlays.current[IDX(mx,my)] = 0; }
          });
        }
      }
    }
    setFillSel(null);
    redraw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTile, selectedOv, mirror]);

  // ── Canvas rendering ────────────────────────────────────────────────────────
  const [hovCell, setHovCell] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cs = zoom.current;
    const ox = camX.current, oy = camY.current;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Dark void outside the map area
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, W, H);

    const x0 = Math.max(0, Math.floor(ox / cs));
    const x1 = Math.min(GS - 1, Math.ceil((ox + W) / cs));
    const y0 = Math.max(0, Math.floor(oy / cs));
    const y1 = Math.min(GS - 1, Math.ceil((oy + H) / cs));

    const platformCanvas = getPlatformTileCanvas();

    // ── Pass 1: ONE platform image stretched across the entire 60×60 map ───
    const mapSX = -ox, mapSY = -oy, mapSW = GS * cs, mapSH = GS * cs;
    if (platformCanvas) {
      ctx.drawImage(platformCanvas, mapSX, mapSY, mapSW, mapSH);
    } else {
      ctx.fillStyle = "#5a8c44";
      ctx.fillRect(mapSX, mapSY, mapSW, mapSH);
    }

    // ── Pass 2: Tile models — back to front (row order = correct isometric depth) ─
    const SOLID_OD = cs * 0.30;
    const BUSH_OD  = cs * 0.40;
    const WATER_OD = cs * 0.55; // larger to fully close water tile gaps
    // Tall solid tiles (wall, mountain, cactus, wood, stone, pyramid) use extra
    // upward overdraw: since we draw back-to-front, the lower tile covers the
    // upper tile's visible bottom edge — only the bottommost block shows its side.
    const TALL_TILES = new Set([1, 2, 9, 10, 11, 12]);
    // Line tiles (fence, bone) auto-rotate 90° when they only have vertical neighbors
    const LINE_TILES = new Set([5, 6]);
    // Face colours used to "bridge" adjacent same-type tall blocks (hides the top diamond)
    const BLOCK_BRIDGE: Partial<Record<number, string>> = {
      1: "#7A5555", 2: "#506050", 5: "#B8B8B8",
      6: "#C4A050", 9: "#447A22", 10: "#7A5850", 11: "#607080", 12: "#F9D520",
    };

    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const sx = gx * cs - ox, sy = gy * cs - oy;
        const t = cells.current[IDX(gx, gy)];
        const ov = overlays.current[IDX(gx, gy)];

        if (t === 0 && ov === 0) continue; // pure grass — already drawn

        if (t !== 0) {
          const modelCanvas = getTileCanvas(t);
          const tileDef = (TILE_DEFS as readonly { type: number; color: string; icon: string }[]).find(d => d.type === t);

          if (modelCanvas) {
            if (LINE_TILES.has(t)) {
              // Auto-detect orientation: vertical wins when only vertical neighbors present
              const tAbove = gy > 0       ? cells.current[IDX(gx, gy - 1)] : 0;
              const tBelow = gy < GS - 1  ? cells.current[IDX(gx, gy + 1)] : 0;
              const tLeft  = gx > 0       ? cells.current[IDX(gx - 1, gy)] : 0;
              const tRight = gx < GS - 1  ? cells.current[IDX(gx + 1, gy)] : 0;
              const hasVert  = (tAbove === t || tBelow === t);
              const hasHoriz = (tLeft  === t || tRight === t);
              const isVertical = hasVert && !hasHoriz;
              const od = SOLID_OD;
              if (isVertical) {
                ctx.save();
                ctx.translate(sx + cs / 2, sy + cs / 2);
                ctx.rotate(Math.PI / 2);
                ctx.drawImage(modelCanvas, -cs / 2 - od, -cs / 2 - od, cs + od * 2, cs + od * 2);
                ctx.restore();
              } else {
                ctx.drawImage(modelCanvas, sx - od, sy - od, cs + od * 2, cs + od * 2);
              }
            } else if (TALL_TILES.has(t)) {
              // Asymmetric overdraw: big upward so lower tiles cover upper tiles' bottom edges
              const odSide = SOLID_OD;
              const odTop  = cs * 0.65;
              ctx.drawImage(modelCanvas, sx - odSide, sy - odTop, cs + odSide * 2, cs + odTop + odSide);
              // When the same type is directly above (north), fill the top-diamond region
              // with the block's face colour so the two sprites appear as one continuous wall.
              const hasSameNorth = gy > 0 && cells.current[IDX(gx, gy - 1)] === t;
              if (hasSameNorth) {
                const bridgeCol = BLOCK_BRIDGE[t];
                if (bridgeCol) {
                  ctx.fillStyle = bridgeCol;
                  ctx.fillRect(sx - odSide, sy - odTop, cs + odSide * 2, odTop * 0.80);
                }
              }
            } else {
              // Barrel (type 7) is drawn without side overdraw so it stays within the cell
              const od = t === 3 ? BUSH_OD : t === 4 ? WATER_OD : t === 7 ? 0 : SOLID_OD;
              ctx.drawImage(modelCanvas, sx - od, sy - od, cs + od * 2, cs + od * 2);
            }
          } else {
            // Models not loaded yet — fallback flat colour + icon
            ctx.fillStyle = tileDef?.color ?? "#888";
            ctx.fillRect(sx, sy, cs, cs);
            if (cs >= 18) {
              ctx.font = `${Math.min(cs * 0.5, 16)}px serif`;
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText(tileDef?.icon ?? "?", sx + cs / 2, sy + cs / 2);
            }
          }
        }

        // Overlay markers (spawn points, safes, goals, etc.)
        if (ov !== 0) {
          const ovDef = ALL_OVERLAY_DEFS.find(d => d.ov === ov);
          if (ovDef) {
            const r = cs * 0.38;
            ctx.save();
            const isSafeOv = ov === OV.SAFE_BLUE || ov === OV.SAFE_RED
              || ov === OV.BASE_BLUE || ov === OV.BASE_RED;
            if (ov === OV.POWER_BOX) {
              const boxSprite = getPowerBoxCanvas();
              if (boxSprite) {
                const D = cs * 1.4;
                ctx.globalAlpha = 0.95;
                ctx.shadowColor = "#CE93D8";
                ctx.shadowBlur = 10;
                ctx.drawImage(boxSprite, sx + cs / 2 - D / 2, sy + cs / 2 - D / 2 - 2, D, D);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
              } else {
                ctx.globalAlpha = 0.92;
                ctx.fillStyle = ovDef.color;
                ctx.beginPath();
                ctx.arc(sx + cs / 2, sy + cs / 2, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.font = `${Math.min(r * 1.2, 18)}px serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(ovDef.icon, sx + cs / 2, sy + cs / 2);
              }
            } else if (isSafeOv) {
              const safeSprite = getSafeCanvas();
              if (safeSprite) {
                const D = cs * 1.35;
                ctx.globalAlpha = 0.95;
                ctx.shadowColor = ovDef.color;
                ctx.shadowBlur = 10;
                ctx.drawImage(safeSprite, sx + cs / 2 - D / 2, sy + cs / 2 - D / 2 - 2, D, D);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
                // Team tint
                const isBlue = ov === OV.SAFE_BLUE || ov === OV.BASE_BLUE;
                ctx.fillStyle = isBlue ? "rgba(25,100,210,0.22)" : "rgba(210,30,30,0.22)";
                ctx.fillRect(sx + cs / 2 - D / 2, sy + cs / 2 - D / 2 - 2, D, D);
              } else {
                ctx.globalAlpha = 0.92;
                ctx.fillStyle = ovDef.color;
                ctx.beginPath();
                ctx.arc(sx + cs / 2, sy + cs / 2, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.font = `${Math.min(r * 1.2, 18)}px serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(ovDef.icon, sx + cs / 2, sy + cs / 2);
              }
            } else {
              ctx.globalAlpha = 0.92;
              ctx.fillStyle = ovDef.color;
              ctx.beginPath();
              ctx.arc(sx + cs / 2, sy + cs / 2, r, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
              if (cs >= 16) {
                ctx.font = `${Math.min(r * 1.2, 18)}px serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(ovDef.icon, sx + cs / 2, sy + cs / 2);
              }
            }
            ctx.restore();
          }
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let gx = x0; gx <= x1 + 1; gx++) {
      const sx = gx * cs - ox;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = y0; gy <= y1 + 1; gy++) {
      const sy = gy * cs - oy;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    // Center cross (for gem grab etc.)
    const halfSx = 30 * cs - ox, halfSy = 30 * cs - oy;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(halfSx, 0); ctx.lineTo(halfSx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, halfSy); ctx.lineTo(W, halfSy); ctx.stroke();
    ctx.setLineDash([]);

    // Half-map border (for symmetric placement guidance)
    ctx.strokeStyle = "rgba(255,255,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-ox, -oy, GS * cs, GS * cs);

    // Fill rect selection
    if (fillSel) {
      const fx0 = Math.min(fillSel.x0, fillSel.x1) * cs - ox;
      const fy0 = Math.min(fillSel.y0, fillSel.y1) * cs - oy;
      const fw = (Math.abs(fillSel.x1 - fillSel.x0) + 1) * cs;
      const fh = (Math.abs(fillSel.y1 - fillSel.y0) + 1) * cs;
      ctx.fillStyle = "rgba(255,255,0,0.15)";
      ctx.fillRect(fx0, fy0, fw, fh);
      ctx.strokeStyle = "#FFD54F";
      ctx.lineWidth = 2;
      ctx.strokeRect(fx0, fy0, fw, fh);
    }

    // Hover highlight
    if (hovCell) {
      const sx = hovCell.x * cs - ox, sy = hovCell.y * cs - oy;
      ctx.strokeStyle = "#ffffff99";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, cs - 2, cs - 2);
      // Mirror highlights
      mirrorCells(hovCell.x, hovCell.y).slice(1).forEach(([mx, my]) => {
        const msx = mx * cs - ox, msy = my * cs - oy;
        ctx.strokeStyle = "#FFD54F88";
        ctx.strokeRect(msx + 1, msy + 1, cs - 2, cs - 2);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceRedraw, hovCell, fillSel, zoom.current, camX.current, camY.current]);

  // ── Resize canvas to parent ─────────────────────────────────────────────────
  const initialCamSet = useRef(false);
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      const pw = c.parentElement?.clientWidth  ?? window.innerWidth;
      const ph = c.parentElement?.clientHeight ?? window.innerHeight;
      if (pw === 0 || ph === 0) return; // layout not settled yet
      c.width  = pw;
      c.height = ph;
      // On first load, zoom so the full 60-cell map fills the canvas width
      if (!initialCamSet.current) {
        initialCamSet.current = true;
        zoom.current = Math.max(6, Math.min(24, Math.floor(c.width / GS)));
        const mapPx = GS * zoom.current;
        camX.current = 0;
        camY.current = Math.max(0, (mapPx - c.height) / 2);
      }
      clampCam();
      redraw();
    };
    // Defer so parent flex container has settled to its final dimensions
    const rafId = requestAnimationFrame(resize);
    window.addEventListener("resize", resize);
    // Fullscreen transitions need two animation frames before the layout settles
    const handleFullscreen = () => { requestAnimationFrame(() => { requestAnimationFrame(resize); }); };
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Right-click or middle-click always pans
    if (e.button === 1 || e.button === 2) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    // Pan tool or no tile selected — left-click pans too
    if (tool === "pan" || (tool === "place" && selectedTile === 0 && selectedOv === 0)) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    const { gx, gy } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);

    if (tool === "fill_rect") {
      fillStart.current = { x: gx, y: gy };
      setFillSel({ x0: gx, y0: gy, x1: gx, y1: gy });
    } else {
      isDrawing.current = true;
      brushLastCell.current = { x: gx, y: gy };
      applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
    }
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { gx, gy } = screenToGrid(sx, sy);
    setHovCell({ x: gx, y: gy });

    if (isPanning.current) {
      camX.current -= e.clientX - lastMouse.current.x;
      camY.current -= e.clientY - lastMouse.current.y;
      clampCam();
      lastMouse.current = { x: e.clientX, y: e.clientY };
      redraw();
      return;
    }

    if (isDrawing.current && (tool === "place" || tool === "brush" || tool === "erase")) {
      if (!brushLastCell.current || brushLastCell.current.x !== gx || brushLastCell.current.y !== gy) {
        applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
        brushLastCell.current = { x: gx, y: gy };
      }
    }

    if (fillStart.current && tool === "fill_rect") {
      setFillSel({ x0: fillStart.current.x, y0: fillStart.current.y, x1: gx, y1: gy });
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning.current) { isPanning.current = false; return; }
    if (fillStart.current && fillSel && tool === "fill_rect") {
      applyFillRect(fillSel);
      fillStart.current = null;
    }
    isDrawing.current = false;
    brushLastCell.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const worldX = (mx + camX.current) / zoom.current;
    const worldY = (my + camY.current) / zoom.current;
    const delta = e.deltaY > 0 ? -2 : 2;
    zoom.current = Math.max(6, Math.min(36, zoom.current + delta));
    camX.current = worldX * zoom.current - mx;
    camY.current = worldY * zoom.current - my;
    clampCam();
    redraw();
  };

  // ── Touch support ───────────────────────────────────────────────────────────
  const lastTouches = useRef<React.Touch[]>([]);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouches.current = Array.from(e.touches) as React.Touch[];
    if (e.touches.length === 1) {
      const isPanMode = tool === "pan" || (tool === "place" && selectedTile === 0 && selectedOv === 0);
      if (isPanMode) {
        isPanning.current = true;
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else {
        const rect = canvasRef.current!.getBoundingClientRect();
        const t = e.touches[0];
        const { gx, gy } = screenToGrid(t.clientX - rect.left, t.clientY - rect.top);
        isDrawing.current = true;
        applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
      }
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      const pa = lastTouches.current[0], pb = lastTouches.current[1];
      if (pa && pb) {
        const prevDist = Math.hypot(pa.clientX - pb.clientX, pa.clientY - pb.clientY);
        const curDist  = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = curDist / prevDist;
        const oldZ = zoom.current;
        zoom.current = Math.max(6, Math.min(36, Math.round(oldZ * ratio)));
        const cx = (a.clientX + b.clientX) / 2;
        const cy = (a.clientY + b.clientY) / 2;
        const rect = canvasRef.current!.getBoundingClientRect();
        const wx = (cx - rect.left + camX.current) / oldZ;
        const wy = (cy - rect.top  + camY.current) / oldZ;
        camX.current = wx * zoom.current - (cx - rect.left);
        camY.current = wy * zoom.current - (cy - rect.top);
        clampCam();
      }
      // Pan with two fingers
      if (pa && pb) {
        const prevMid = { x: (pa.clientX + pb.clientX) / 2, y: (pa.clientY + pb.clientY) / 2 };
        const curMid  = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        camX.current -= curMid.x - prevMid.x;
        camY.current -= curMid.y - prevMid.y;
        clampCam();
      }
      redraw();
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      if (isPanning.current) {
        const dx = t.clientX - lastMouse.current.x;
        const dy = t.clientY - lastMouse.current.y;
        camX.current -= dx;
        camY.current -= dy;
        lastMouse.current = { x: t.clientX, y: t.clientY };
        clampCam();
        redraw();
      } else if (isDrawing.current) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const { gx, gy } = screenToGrid(t.clientX - rect.left, t.clientY - rect.top);
        if (!brushLastCell.current || brushLastCell.current.x !== gx || brushLastCell.current.y !== gy) {
          applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
          brushLastCell.current = { x: gx, y: gy };
        }
      }
    }
    lastTouches.current = Array.from(e.touches) as React.Touch[];
  };
  const onTouchEnd = () => { isDrawing.current = false; isPanning.current = false; };

  // ── Map actions ─────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (!confirm("Очистить всю карту?")) return;
    cells.current    = new Array(GS * GS).fill(0);
    overlays.current = new Array(GS * GS).fill(0);
    redraw();
  };

  const handleRandom = () => {
    if (!mode) return;
    const gen = generateRandomMap(mode);
    cells.current    = gen.cells;
    overlays.current = gen.overlays;
    redraw();
    notify("Карта сгенерирована случайно");
  };

  const handleSave = (name: string) => {
    if (!mode) return;
    const map: MapSave = {
      id: currentId ?? `map_${Date.now()}`,
      name, mode,
      cells:    Array.from(cells.current),
      overlays: Array.from(overlays.current),
      createdAt: currentId ? (getSavedMaps().find(m => m.id === currentId)?.createdAt ?? Date.now()) : Date.now(),
      updatedAt: Date.now(),
    };
    upsertMap(map);
    setCurrentId(map.id);
    setSaveName(name);
    setShowSave(false);
    notify(`Карта «${name}» сохранена`);
  };

  const handleLoad = (map: MapSave) => {
    cells.current    = [...map.cells];
    overlays.current = [...map.overlays];
    setCurrentId(map.id);
    setSaveName(map.name);
    setMode(map.mode);
    setShowMaps(false);
    redraw();
    notify(`Карта «${map.name}» загружена`);
  };

  const handleDelete = (id: string) => {
    deleteMapById(id);
    if (currentId === id) setCurrentId(null);
    setMaps(getSavedMaps());
  };

  const doPublish = (map: MapSave) => {
    publishMap({ ...map, cells: Array.from(cells.current), overlays: Array.from(overlays.current), updatedAt: Date.now() });
    setShowMaps(false);
    notify(`Карта «${map.name}» опубликована для режима ${EDITOR_MODES.find(m => m.id === map.mode)?.label}`);
  };

  const handlePublishCurrent = () => {
    if (!mode) return;
    const res = validateMap(cells.current, overlays.current, mode);
    if (res.ok) {
      const map: MapSave = {
        id: currentId ?? `map_${Date.now()}`,
        name: saveName, mode,
        cells: Array.from(cells.current),
        overlays: Array.from(overlays.current),
        createdAt: currentId ? Date.now() : Date.now(),
        updatedAt: Date.now(),
      };
      upsertMap(map);
      doPublish(map);
    } else {
      setValResult({
        errors: res.errors,
        action: () => {
          const map: MapSave = {
            id: currentId ?? `map_${Date.now()}`,
            name: saveName, mode,
            cells: Array.from(cells.current),
            overlays: Array.from(overlays.current),
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          upsertMap(map);
          doPublish(map);
          setValResult(null);
        },
      });
    }
  };

  const handleExport = () => {
    if (!mode) return;
    const data = JSON.stringify({ name: saveName, mode, cells: cells.current, overlays: overlays.current }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `${saveName}.json`;
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (!data.cells || data.cells.length !== GS * GS) throw new Error("Неверный формат");
          cells.current    = [...data.cells];
          overlays.current = data.overlays?.length === GS * GS ? [...data.overlays] : new Array(GS * GS).fill(0);
          if (data.mode) setMode(data.mode as EditorMode);
          if (data.name) setSaveName(data.name);
          setCurrentId(null);
          redraw();
          notify("Карта импортирована");
        } catch (err: any) {
          notify("Ошибка импорта: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Show mode select if no mode chosen
  if (!mode) {
    return <ModeSelectModal onSelect={(m) => { setMode(m); }} />;
  }

  const modeInfo = EDITOR_MODES.find(m => m.id === mode)!;
  const allMaps = getSavedMaps();

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#0a0020",
      display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: "none",
    }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, background: "rgba(0,0,0,0.7)", borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", gap: 8, padding: "0 12px", flexShrink: 0,
        overflowX: "auto",
      }}>
        <button onClick={onBack} style={tbBtn("#FF5252")}>← Выйти</button>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

        {/* Mode chip */}
        <div style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "rgba(255,255,255,0.7)",
          flexShrink: 0, whiteSpace: "nowrap",
        }}>
          {modeInfo.icon} {modeInfo.label}
        </div>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

        {/* Tools */}
        <ToolBtn active={tool === "pan"}       onClick={() => setTool("pan")}      label="✋ Пан" />
        <ToolBtn active={tool === "place"}     onClick={() => setTool("place")}    label="✏️ Ставить" />
        <ToolBtn active={tool === "erase"}     onClick={() => setTool("erase")}    label="🧹 Ластик" />
        <ToolBtn active={tool === "brush"}     onClick={() => setTool("brush")}    label="🖌️ Кисть" />
        <ToolBtn active={tool === "fill_rect"} onClick={() => setTool("fill_rect")}label="▭ Заполнить" />

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

        {/* Mirror */}
        <select
          value={mirror}
          onChange={e => setMirror(e.target.value as Mirror)}
          style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8, padding: "4px 8px", color: "white", fontSize: 12, cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <option value="none">🔲 Без зеркала</option>
          <option value="h">↔ По гориз.</option>
          <option value="v">↕ По верт.</option>
          <option value="both">⊞ Оба</option>
        </select>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

        <button onClick={handleClear}  style={tbBtn("#FF7043")}>🗑️ Очистить</button>
        <button onClick={handleRandom} style={tbBtn("#AB47BC")}>🎲 Рандом</button>
        <button onClick={() => { setMaps(getSavedMaps()); setShowMaps(true); }} style={tbBtn("#26C6DA")}>📂 Карты</button>
        <button onClick={() => setShowSave(true)} style={tbBtn("#66BB6A")}>💾 Сохранить</button>
        <button onClick={handlePublishCurrent}     style={tbBtn("#FFD54F")}>🌐 Опубликовать</button>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

        <button onClick={handleExport} style={tbBtn("rgba(255,255,255,0.4)")}>⬇ Экспорт</button>
        <button onClick={handleImport} style={tbBtn("rgba(255,255,255,0.4)")}>⬆ Импорт</button>

        <button onClick={() => {
          lockAdmin();
          onBack();
        }} style={{ ...tbBtn("#FF5252"), marginLeft: "auto", flexShrink: 0 }}>🔒 Выйти</button>
      </div>

      {/* ── Canvas area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", cursor: tool === "pan" ? (isPanning.current ? "grabbing" : "grab") : tool === "erase" ? "cell" : "crosshair" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { isPanning.current = false; isDrawing.current = false; setHovCell(null); }}
          onWheel={onWheel}
          onContextMenu={e => e.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />

        {/* Zoom indicator */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "4px 10px",
          fontSize: 11, color: "rgba(255,255,255,0.5)",
        }}>
          {zoom.current}px/кл
        </div>

        {/* Notification */}
        {notification && (
          <div style={{
            position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)", borderRadius: 12, padding: "10px 20px",
            color: "#69F0AE", fontWeight: 700, fontSize: 14,
            border: "1px solid rgba(105,240,174,0.3)", whiteSpace: "nowrap",
          }}>
            {notification}
          </div>
        )}
      </div>

      {/* ── Bottom palette ────────────────────────────────────────────────── */}
      <div style={{
        height: 82, background: "rgba(0,0,0,0.85)", borderTop: "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", gap: 6, padding: "0 12px",
        overflowX: "auto", flexShrink: 0,
      }}>
        {/* Tile palette — uses pre-rendered 3D model thumbnails */}
        {TILE_DEFS.map(td => (
          <TileModelPaletteItem
            key={td.type}
            tileType={td.type} label={td.label} color={td.color} icon={td.icon}
            active={selectedOv === 0 && selectedTile === td.type}
            modelsReady={modelsReady}
            onClick={() => {
              setSelectedTile(td.type);
              setSelectedOv(0);
              if (tool !== "erase" && tool !== "brush" && tool !== "fill_rect") setTool("place");
            }}
          />
        ))}

        <div style={{ width: 2, height: 54, background: "rgba(255,255,255,0.15)", flexShrink: 0, margin: "0 4px" }} />

        {/* Overlay palette — filtered to current mode only */}
        {ALL_OVERLAY_DEFS.filter(od => mode && MODE_OVERLAYS[mode]?.includes(od.ov)).map(od => (
          <PaletteItem
            key={od.ov}
            icon={od.icon} label={od.label} color={od.color}
            active={selectedOv === od.ov}
            onClick={() => {
              setSelectedOv(od.ov);
              if (tool !== "erase" && tool !== "brush" && tool !== "fill_rect") setTool("place");
            }}
          />
        ))}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showSave && (
        <SaveModal
          defaultName={saveName}
          onSave={handleSave}
          onCancel={() => setShowSave(false)}
        />
      )}

      {showMaps && (
        <MapsModal
          maps={allMaps}
          currentMode={mode}
          onLoad={handleLoad}
          onDelete={handleDelete}
          onPublish={map => {
            const res = validateMap(cells.current, overlays.current, mode);
            if (res.ok) doPublish(map);
            else setValResult({ errors: res.errors, action: () => { doPublish(map); setValResult(null); } });
          }}
          onClose={() => setShowMaps(false)}
        />
      )}

      {valResult && (
        <ValidationModal
          errors={valResult.errors}
          onClose={() => setValResult(null)}
          onForce={valResult.action}
        />
      )}
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, backdropFilter: "blur(4px)",
    }}>
      {children}
    </div>
  );
}

function ModalBox({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      background: "linear-gradient(160deg, #0e0035, #050018)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 20, padding: 28,
      width: wide ? 560 : 380, maxWidth: "90vw",
      boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
    }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: "white" }}>{title}</h2>
      {children}
    </div>
  );
}

function Btn({ children, color, onClick }: { children: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 18px", borderRadius: 10,
      background: color + "22", border: `1px solid ${color}55`,
      color, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

function SmBtn({ children, color, onClick }: { children: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 10px", borderRadius: 8,
      background: color + "20", border: `1px solid ${color}50`,
      color, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function ToolBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
      fontFamily: "inherit", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap",
      background: active ? "rgba(105,240,174,0.2)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${active ? "rgba(105,240,174,0.5)" : "rgba(255,255,255,0.1)"}`,
      color: active ? "#69F0AE" : "rgba(255,255,255,0.7)",
    }}>{label}</button>
  );
}

function tbBtn(color: string): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
    fontFamily: "inherit", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap",
    background: color + "18", border: `1px solid ${color}40`, color,
  };
}

function PaletteItem({ icon, label, color, active, onClick }: {
  icon: string; label: string; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "6px 8px", borderRadius: 10, cursor: "pointer", flexShrink: 0,
      background: active ? color + "33" : "rgba(255,255,255,0.04)",
      border: `2px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
      color: "white", fontFamily: "inherit",
      boxShadow: active ? `0 0 12px ${color}66` : "none",
      minWidth: 52,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 9, color: active ? color : "rgba(255,255,255,0.5)", fontWeight: 700, lineHeight: 1.2, textAlign: "center" }}>
        {label}
      </span>
    </button>
  );
}

function TileModelPaletteItem({ tileType, label, color, icon, active, modelsReady, onClick }: {
  tileType: number; label: string; color: string; icon: string; active: boolean; modelsReady: boolean; onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const modelCanvas = getTileCanvas(tileType);
    ctx.clearRect(0, 0, 48, 48);
    if (modelCanvas) {
      if (tileType === 3) {
        // BUSH — tall canvas (256×512), show full model squished to fit
        ctx.drawImage(modelCanvas, 0, 0, 48, 48);
      } else {
        ctx.drawImage(modelCanvas, 0, 0, 48, 48);
      }
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 48, 48);
      ctx.font = "24px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(icon, 24, 24);
    }
  }, [modelsReady, tileType, color, icon]);

  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "4px 6px", borderRadius: 10, cursor: "pointer", flexShrink: 0,
      background: active ? color + "33" : "rgba(255,255,255,0.04)",
      border: `2px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
      color: "white", fontFamily: "inherit",
      boxShadow: active ? `0 0 12px ${color}66` : "none",
      minWidth: 52,
    }}>
      <canvas
        ref={canvasRef}
        width={48} height={48}
        style={{ width: 48, height: 48, borderRadius: 6, imageRendering: "pixelated" }}
      />
      <span style={{ fontSize: 9, color: active ? color : "rgba(255,255,255,0.5)", fontWeight: 700, lineHeight: 1.2, textAlign: "center" }}>
        {label}
      </span>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "10px 14px", borderRadius: 10,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
  color: "white", fontSize: 15, fontFamily: "inherit", outline: "none",
};

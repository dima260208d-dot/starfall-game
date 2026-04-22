import { useState } from "react";
import {
  getCurrentProfile, getAllProfiles, setCurrentUsername, addGems,
  getControlMode, setControlMode, type ControlMode,
} from "../utils/localStorageAPI";

interface SettingsPageProps {
  onBack: () => void;
  onSwitchProfile: () => void;
}

export default function SettingsPage({ onBack, onSwitchProfile }: SettingsPageProps) {
  const [profile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState("");
  const [ctrl, setCtrl] = useState<ControlMode>(getControlMode());

  const pickControlMode = (m: ControlMode) => {
    setControlMode(m);
    setCtrl(m);
    setMsg(m === "mobile" ? "Управление: Телефон (джойстики)" : "Управление: ПК (клавиатура + мышь)");
    setTimeout(() => setMsg(""), 2500);
  };

  const handleAddGems = () => {
    addGems(100);
setMsg("+100 кристаллов добавлено для теста!");
    setTimeout(() => setMsg(""), 3000);
  };

  const handleSwitchProfile = () => {
    setCurrentUsername(null);
    onSwitchProfile();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 16px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ← Назад
        </button>
        <h2 style={{ flex: 1, textAlign: "center", margin: 0, fontSize: 22, fontWeight: 800, color: "#69F0AE" }}>Настройки</h2>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ flex: 1, padding: "40px 24px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <Section title="Профиль">
          {profile && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{profile.username}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
                <div style={{ color: "#FFD700" }}>Монеты: {profile.coins}</div>
                <div style={{ color: "#40C4FF" }}>Кристаллы: {profile.gems}</div>
                <div style={{ color: "#CE93D8" }}>Очки силы: {profile.powerPoints}</div>
                <div style={{ color: "rgba(255,255,255,0.5)" }}>Победы: {profile.totalWins}/{profile.totalGamesPlayed}</div>
              </div>
            </div>
          )}
<Button onClick={handleSwitchProfile} color="#FF5252" label="Сменить профиль" />
        </Section>

        <Section title="Режим управления">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <ModeCard
              active={ctrl === "pc"}
              icon="🖥️"
              title="ПК"
              subtitle="Клавиатура + мышь"
              onClick={() => pickControlMode("pc")}
              color="#40C4FF"
            />
            <ModeCard
              active={ctrl === "mobile"}
              icon="📱"
              title="Телефон"
              subtitle="Джойстики на экране"
              onClick={() => pickControlMode("mobile")}
              color="#FFD54F"
            />
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16 }}>
            {(ctrl === "pc"
              ? [
                  ["Движение", "WASD или стрелки"],
                  ["Прицел", "Мышь"],
                  ["Атака", "ЛКМ или Пробел"],
                  ["Супер", "ПКМ или E"],
                  ["Выход", "ESC (кнопка справа сверху)"],
                ]
              : [
                  ["Движение", "Синий джойстик справа"],
                  ["Атака", "Красный джойстик слева"],
                  ["Супер", "Жёлтый джойстик возле атаки"],
                  ["Прицел", "Тяни джойстик в нужную сторону"],
                  ["Авто-прицел", "Короткое нажатие на джойстик атаки/супера"],
                ]
            ).map(([action, key]) => (
              <div key={action} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{action}</span>
                <span style={{ color: "white", fontWeight: 700, fontSize: 13, background: "rgba(255,255,255,0.1)", padding: "2px 10px", borderRadius: 6, textAlign: "right" }}>{key}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Тестовые инструменты">
          <Button onClick={handleAddGems} color="#40C4FF" label="+100 кристаллов (тест)" />
        </Section>

        {msg && (
          <div style={{ textAlign: "center", padding: 14, background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 12, color: "#4CAF50", fontWeight: 700 }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>{title.toUpperCase()}</div>
      {children}
    </div>
  );
}

function ModeCard({
  active, icon, title, subtitle, onClick, color,
}: { active: boolean; icon: string; title: string; subtitle: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? `${color}28` : "rgba(255,255,255,0.04)",
        border: `2px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14,
        padding: "14px 12px",
        color: "white",
        cursor: "pointer",
        textAlign: "center",
        boxShadow: active ? `0 0 18px ${color}55` : "none",
        transition: "transform 0.12s",
      }}
    >
      <div style={{ fontSize: 32, lineHeight: 1 }}>{icon}</div>
      <div style={{ marginTop: 6, fontWeight: 800, fontSize: 14, color: active ? color : "white" }}>{title}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{subtitle}</div>
      {active && (
        <div style={{ marginTop: 6, fontSize: 10, fontWeight: 800, letterSpacing: 1, color }}>✓ ВЫБРАНО</div>
      )}
    </button>
  );
}

function Button({ onClick, color, label }: { onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: `${color}20`,
        border: `1px solid ${color}40`,
        borderRadius: 12,
        padding: "12px 0",
        color,
        fontWeight: 700,
        fontSize: 15,
        cursor: "pointer",
        marginBottom: 8,
      }}
    >
      {label}
    </button>
  );
}

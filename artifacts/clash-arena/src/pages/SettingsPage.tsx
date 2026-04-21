import { useState } from "react";
import { getCurrentProfile, getAllProfiles, setCurrentUsername, addGems } from "../utils/localStorageAPI";

interface SettingsPageProps {
  onBack: () => void;
  onSwitchProfile: () => void;
}

export default function SettingsPage({ onBack, onSwitchProfile }: SettingsPageProps) {
  const [profile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState("");

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

        <Section title="Управление">
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16 }}>
            {[
              ["Движение", "WASD или стрелки"],
              ["Прицел", "Мышь"],
              ["Атака", "ЛКМ или Пробел"],
              ["Супер", "ПКМ или E"],
              ["Выход", "ESC (кнопка справа сверху)"],
            ].map(([action, key]) => (
              <div key={action} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{action}</span>
                <span style={{ color: "white", fontWeight: 700, fontSize: 14, background: "rgba(255,255,255,0.1)", padding: "2px 10px", borderRadius: 6 }}>{key}</span>
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

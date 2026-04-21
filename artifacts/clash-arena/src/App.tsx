import { useState, useEffect } from "react";
import { getCurrentUsername, getCurrentProfile, setSelectedBrawler as persistBrawler, setSelectedMode as persistMode, logout } from "./utils/localStorageAPI";
import AuthPage from "./pages/AuthPage";
import MainMenu from "./pages/MainMenu";
import ModeSelect from "./pages/ModeSelect";
import CharacterSelect from "./pages/CharacterSelect";
import GameScreen from "./pages/GameScreen";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import ClashPassPage from "./pages/ClashPassPage";
import TrophyRoadPage from "./pages/TrophyRoadPage";
import LoadingScreen from "./pages/LoadingScreen";

type Screen =
  | "auth"
  | "menu"
  | "modeSelect"
  | "characterSelect"
  | "game"
  | "collection"
  | "shop"
  | "settings"
  | "profile"
  | "clashpass"
  | "trophyroad";

export type GameMode = "showdown" | "crystals" | "siege" | "heist" | "gemgrab" | "training";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    return getCurrentUsername() ? "menu" : "auth";
  });
  const initial = getCurrentProfile();
  const [selectedMode, setSelectedMode] = useState<GameMode>((initial?.selectedMode as GameMode) || "showdown");
  const [selectedBrawler, setSelectedBrawler] = useState(initial?.selectedBrawlerId || "miya");

  // Always rehydrate selections from the active profile when entering the menu/game,
  // so a profile switch never carries stale picks across accounts.
  const hydrateFromProfile = () => {
    const p = getCurrentProfile();
    if (!p) return { mode: "showdown" as GameMode, brawler: "miya" };
    const m = (p.selectedMode as GameMode) || "showdown";
    const b = p.selectedBrawlerId || "miya";
    setSelectedMode(m);
    setSelectedBrawler(b);
    return { mode: m, brawler: b };
  };
  const [bootLoading, setBootLoading] = useState(true);
  const [transitionTo, setTransitionTo] = useState<Screen | null>(null);
  const [transitionLabel, setTransitionLabel] = useState("ЗАГРУЗКА");

  useEffect(() => {
    document.title = "Clash Arena";
  }, []);

  const go = (s: Screen) => setScreen(s);

  // Animated transition with a loading screen
  const goWithLoad = (s: Screen, label = "ЗАГРУЗКА") => {
    setTransitionLabel(label);
    setTransitionTo(s);
  };

  if (bootLoading) {
    return <LoadingScreen onDone={() => setBootLoading(false)} duration={2600} label="ДОБРО ПОЖАЛОВАТЬ" />;
  }

  if (transitionTo) {
    return (
      <LoadingScreen
        label={transitionLabel}
        duration={1800}
        onDone={() => {
          const target = transitionTo;
          setTransitionTo(null);
          if (target) go(target);
        }}
      />
    );
  }

  if (screen === "auth") {
    return <AuthPage onAuth={() => { hydrateFromProfile(); go("menu"); }} />;
  }

  if (screen === "menu") {
    return (
      <MainMenu
        onPlay={() => {
          // Always read latest selections from the active profile before entering battle.
          hydrateFromProfile();
          goWithLoad("game", "ВХОД В АРЕНУ");
        }}
        onCollection={() => go("collection")}
        onShop={() => go("shop")}
        onSettings={() => go("settings")}
        onProfile={() => go("profile")}
        onClashPass={() => go("clashpass")}
        onTrophyRoad={() => go("trophyroad")}
        onModeSelect={() => go("modeSelect")}
        onBrawlerSelect={() => go("characterSelect")}
        onLogout={() => { logout(); go("auth"); }}
      />
    );
  }

  if (screen === "modeSelect") {
    return (
      <ModeSelect
        onSelect={(mode) => { setSelectedMode(mode); persistMode(mode); go("menu"); }}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "characterSelect") {
    return (
      <CharacterSelect
        onPickAsActive={(id) => { setSelectedBrawler(id); persistBrawler(id); }}
        onTraining={(id) => {
          setSelectedBrawler(id);
          persistBrawler(id);
          setSelectedMode("training");
          persistMode("training");
          goWithLoad("game", "ВХОД В ТРЕНИРОВКУ");
        }}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "profile") {
    return <ProfilePage onBack={() => go("menu")} />;
  }
  if (screen === "clashpass") {
    return <ClashPassPage onBack={() => go("menu")} />;
  }
  if (screen === "trophyroad") {
    return <TrophyRoadPage onBack={() => go("menu")} />;
  }

  if (screen === "game") {
    return (
      <GameScreen
        mode={selectedMode}
        brawlerId={selectedBrawler}
        onExit={() => goWithLoad("menu", "ВОЗВРАТ В ЛОББИ")}
      />
    );
  }

  if (screen === "collection") {
    return <CollectionPage onBack={() => go("menu")} />;
  }

  if (screen === "shop") {
    return <ShopPage onBack={() => go("menu")} />;
  }

  if (screen === "settings") {
    return (
      <SettingsPage
        onBack={() => go("menu")}
        onSwitchProfile={() => { logout(); go("auth"); }}
      />
    );
  }

  return null;
}

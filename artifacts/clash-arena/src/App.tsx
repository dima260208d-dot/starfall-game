import { useState, useEffect } from "react";
import { getCurrentProfile, getCurrentUsername } from "./utils/localStorageAPI";
import AuthPage from "./pages/AuthPage";
import MainMenu from "./pages/MainMenu";
import ModeSelect from "./pages/ModeSelect";
import CharacterSelect from "./pages/CharacterSelect";
import GameScreen from "./pages/GameScreen";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import SettingsPage from "./pages/SettingsPage";

type Screen =
  | "auth"
  | "menu"
  | "modeSelect"
  | "characterSelect"
  | "game"
  | "collection"
  | "shop"
  | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    return getCurrentUsername() ? "menu" : "auth";
  });
  const [selectedMode, setSelectedMode] = useState<"showdown" | "crystals">("showdown");
  const [selectedBrawler, setSelectedBrawler] = useState("miya");

  useEffect(() => {
    document.title = "Clash Arena";
  }, []);

  const go = (s: Screen) => setScreen(s);

  if (screen === "auth") {
    return <AuthPage onAuth={() => go("menu")} />;
  }

  if (screen === "menu") {
    return (
      <MainMenu
        onPlay={() => go("modeSelect")}
        onCollection={() => go("collection")}
        onShop={() => go("shop")}
        onSettings={() => go("settings")}
        onLogout={() => {
          go("auth");
        }}
      />
    );
  }

  if (screen === "modeSelect") {
    return (
      <ModeSelect
        onSelect={(mode) => { setSelectedMode(mode); go("characterSelect"); }}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "characterSelect") {
    return (
      <CharacterSelect
        mode={selectedMode}
        onStart={(id) => { setSelectedBrawler(id); go("game"); }}
        onBack={() => go("modeSelect")}
      />
    );
  }

  if (screen === "game") {
    return (
      <GameScreen
        mode={selectedMode}
        brawlerId={selectedBrawler}
        onExit={() => go("menu")}
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
        onSwitchProfile={() => go("auth")}
      />
    );
  }

  return null;
}

import Phaser from "phaser";
import { items } from "./content";
import { getQuest, getQuestStepLabel } from "./quests";
import { saveGameState } from "./session";
import type { GameState } from "./state";
import { addPixelText, setPixelText } from "./uiText";

type MenuOption = "Save" | "Quests" | "Items" | "Character";

const options: MenuOption[] = ["Save", "Quests", "Items", "Character"];

export class GameMenu {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.BitmapText;
  private readonly optionText: Phaser.GameObjects.BitmapText;
  private readonly detailText: Phaser.GameObjects.BitmapText;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly menuKey: Phaser.Input.Keyboard.Key;
  private readonly escapeKey: Phaser.Input.Keyboard.Key;
  private readonly confirmKey: Phaser.Input.Keyboard.Key;
  private selectedIndex = 0;
  private visible = false;
  private saveMessage = "PRESS SPACE TO SAVE";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getState: () => GameState,
  ) {
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.menuKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.escapeKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.confirmKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.box = scene.add.rectangle(160, 92, 292, 146, 0x050505, 0.97)
      .setStrokeStyle(2, 0xf8fafc)
      .setDepth(100)
      .setScrollFactor(0)
      .setVisible(false);
    this.title = addPixelText(scene, 120, 19, "Command", 8)
      .setTint(0xfacc15)
      .setDepth(101)
      .setScrollFactor(0)
      .setVisible(false);
    this.optionText = addPixelText(scene, 24, 48, "", 7)
      .setDepth(101)
      .setScrollFactor(0)
      .setVisible(false);
    this.detailText = addPixelText(scene, 104, 48, "", 6)
      .setMaxWidth(190)
      .setDepth(101)
      .setScrollFactor(0)
      .setVisible(false);
  }

  isOpen(): boolean {
    return this.visible;
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.setVisible(!this.visible);
      return;
    }

    if (!this.visible) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.setVisible(false);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex - 1, 0, options.length);
      this.render();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + 1, 0, options.length);
      this.render();
    }

    if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
      this.activate();
    }
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    this.box.setVisible(visible);
    this.title.setVisible(visible);
    this.optionText.setVisible(visible);
    this.detailText.setVisible(visible);

    if (visible) {
      this.render();
    }
  }

  private activate(): void {
    if (options[this.selectedIndex] !== "Save") {
      return;
    }

    saveGameState(this.getState());
    this.saveMessage = "SAVED. TRY NOT TO BREAK TIME.";
    this.render();
  }

  private render(): void {
    setPixelText(
      this.optionText,
      options
        .map((option, index) => `${index === this.selectedIndex ? ">" : " "}${option}`)
        .join("\n"),
    );
    setPixelText(this.detailText, this.getDetailText(options[this.selectedIndex]));
  }

  private getDetailText(option: MenuOption): string {
    const state = this.getState();

    if (option === "Save") {
      return `SAVE GAME\n\n${this.saveMessage}\n\nTHIS BROWSER KEEPS THE HOUSE IN MEMORY.`;
    }

    if (option === "Quests") {
      const quest = getQuest(state.quest.questId);
      const active = getQuestStepLabel(state.quest.questId, state.quest.activeStepId);
      const completed = state.quest.completedStepIds.length === 0
        ? "NONE"
        : state.quest.completedStepIds
          .map((stepId) => getQuestStepLabel(state.quest.questId, stepId))
          .join("\n");
      return `${quest.title}\nACTIVE: ${active}\n\nDONE:\n${completed}`;
    }

    if (option === "Items") {
      const inventory = state.player.inventory.length === 0
        ? "EMPTY"
        : state.player.inventory
          .map((itemId) => {
            const item = items.find((candidate) => candidate.id === itemId);
            return item ? `${item.name}: ${item.description}` : itemId;
          })
          .join("\n");
      const weapon = items.find((item) => item.id === state.player.equipment.weaponId);
      return `EQUIPPED:\n${weapon?.name ?? "NONE"}\n\nBAG:\n${inventory}`;
    }

    const player = state.player;
    return `${player.name || "DAD"}\nLV ${player.level}\nHP ${player.hp}/${player.maxHp}\nDP ${player.dadPoints}/${player.maxDadPoints}\nSTR ${player.strength}\nAGI ${player.agility}\nDEF ${player.defense}\nLOVE ${player.cash}\nXP ${player.xp}`;
  }
}

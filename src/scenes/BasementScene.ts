import Phaser from "phaser";
import { BattleManager } from "../game/BattleManager";
import { dialogue, enemies } from "../game/content";
import { DialogueBox } from "../game/DialogueBox";
import { getDadBrainLine, getDadLine } from "../game/dadVoice";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { GameMenu } from "../game/GameMenu";
import { PlayerStatsPanel } from "../game/PlayerStatsPanel";
import { RandomEncounterTracker } from "../game/EncounterManager";
import { isNear } from "../game/interaction";
import { getQuestStepLabel } from "../game/quests";
import { getGameState } from "../game/session";
import { addWorldSprite, spriteFrames } from "../game/sprites";
import { getMapObjectCenter } from "../game/tilemapObjects";
import { addPixelText, setPixelText } from "../game/uiText";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

type BasementMode = "explore" | "dialogue" | "battle";
type BattleCommand = "Fight" | "Dad Skills" | "Items" | "Run";
type BattlePhase = "command" | "playerResult" | "enemyResult";

const battleCommands: BattleCommand[] = ["Fight", "Dad Skills", "Items", "Run"];

export class BasementScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private exit!: Phaser.GameObjects.Rectangle;
  private coil!: Phaser.GameObjects.Rectangle;
  private coilSprite!: Phaser.GameObjects.Sprite;
  private breaker!: Phaser.GameObjects.Rectangle;
  private breakerSwitch!: Phaser.GameObjects.Rectangle;
  private safetySticker!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.BitmapText;
  private dialogueBox!: DialogueBox;
  private statsPanel!: PlayerStatsPanel;
  private menu!: GameMenu;
  private battleStatusBox!: Phaser.GameObjects.Rectangle;
  private battleStatusText!: Phaser.GameObjects.BitmapText;
  private battleEnemyBox!: Phaser.GameObjects.Rectangle;
  private battleEnemySprite!: Phaser.GameObjects.Sprite;
  private battleEnemyText!: Phaser.GameObjects.BitmapText;
  private commandBox!: Phaser.GameObjects.Rectangle;
  private commandText!: Phaser.GameObjects.BitmapText;
  private mode: BasementMode = "explore";
  private battlePhase: BattlePhase = "command";
  private selectedCommandIndex = 0;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();
  private readonly battle = new BattleManager();
  private readonly randomEncounters = new RandomEncounterTracker("basement");
  private activeEnemyId = "evil-heating-coil";
  private readonly dustBunnyEnemy = enemies.find((candidate) => candidate.id === "dust-bunny");
  private readonly coilEnemy = enemies.find((candidate) => candidate.id === "evil-heating-coil");

  constructor() {
    super("BasementScene");
  }

  create(): void {
    if (!this.dustBunnyEnemy) {
      throw new Error("Missing enemy definition: dust-bunny");
    }

    if (!this.coilEnemy) {
      throw new Error("Missing enemy definition: evil-heating-coil");
    }

    this.state = getGameState();
    this.mode = "explore";
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.createWorld();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);
    this.updateQuestText("BASEMENT");

    if (!this.state.flags.bossDefeated) {
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("basement") },
        ...dialogue.basementIntro.map((text) => ({ speaker: "NARRATOR", text })),
      ]);
    }
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);

    if (this.mode !== "battle") {
      this.menu.update();

      if (this.menu.isOpen()) {
        this.statsPanel.hide();
        return;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode === "battle" && this.battlePhase === "command") {
      this.updateBattleMenuSelection();
      return;
    }

    if (this.mode !== "explore") {
      this.statsPanel.hide();
      return;
    }

    const speed = 1.2;
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown) dx -= speed;
    if (this.cursors.right.isDown) dx += speed;
    if (this.cursors.up.isDown) dy -= speed;
    if (this.cursors.down.isDown) dy += speed;
    const isMoving = dx !== 0 || dy !== 0;

    const nextX = Phaser.Math.Clamp(this.player.x + dx, 18, 302);
    const nextY = Phaser.Math.Clamp(this.player.y + dy, 40, 160);
    this.player.x = nextX;
    this.player.y = nextY;
    this.playerSprite.setPosition(this.player.x, this.player.y);

    this.statsPanel.update(delta, !isMoving, this.state);

    if (isMoving) {
      this.checkRandomEncounter();
    }
  }

  private createWorld(): void {
    const map = this.make.tilemap({ key: "basement-map" });
    const placeholderTileset = map.addTilesetImage("suburban-placeholder", "suburban-placeholder");
    const floorTileset = map.addTilesetImage("floor-options", "floor-options");

    if (!placeholderTileset || !floorTileset) {
      throw new Error("Missing tileset for basement map.");
    }

    map.createLayer("Ground", [placeholderTileset, floorTileset], 0, 0);
    map.createLayer("Props", placeholderTileset, 0, 0);

    const spawn = getMapObjectCenter(map, "Objects", "player-spawn");
    const exit = getMapObjectCenter(map, "Objects", "basement-exit");
    const coil = getMapObjectCenter(map, "Objects", "heating-coil");

    this.exit = this.add.rectangle(exit.x, exit.y, 28, 18, 0xffffff, 0);
    this.coil = this.add.rectangle(coil.x, coil.y, 24, 20, 0xffffff, 0);
    this.breaker = this.add.rectangle(58, 50, 30, 26, 0xffffff, 0);
    this.safetySticker = this.add.rectangle(102, 64, 34, 20, 0xffffff, 0);
    this.player = this.add.rectangle(spawn.x, spawn.y, 14, 18, 0xffffff, 0);
    addWorldSprite(this, exit.x, exit.y, spriteFrames.stairs);
    this.coilSprite = addWorldSprite(this, coil.x, coil.y, spriteFrames.heatingCoil);
    this.add.rectangle(this.breaker.x, this.breaker.y, 24, 24, 0x374151)
      .setStrokeStyle(2, 0xf8fafc);
    this.breakerSwitch = this.add.rectangle(
      this.breaker.x,
      this.breaker.y + (this.state.flags.circuitBreakerOff ? 4 : -4),
      6,
      14,
      this.state.flags.circuitBreakerOff ? 0x22c55e : 0xf97316,
    );
    this.add.rectangle(this.safetySticker.x, this.safetySticker.y, 28, 16, 0xfacc15)
      .setStrokeStyle(1, 0x111827);
    addPixelText(this, this.safetySticker.x - 7, this.safetySticker.y - 3, "!", 8).setTint(0x111827);
    this.playerSprite = addWorldSprite(this, this.player.x, this.player.y, spriteFrames.dad);

    addPixelText(this, exit.x - 10, exit.y + 11, "STAIRS", 6);
    addPixelText(this, coil.x - 15, coil.y + 14, "COIL", 6);
    addPixelText(this, this.breaker.x - 20, this.breaker.y + 18, "BREAKER", 6);
    addPixelText(this, this.safetySticker.x - 17, this.safetySticker.y + 12, "STICKER", 6);
    addPixelText(this, spawn.x - 9, spawn.y - 15, "DAD", 6);

    this.randomEncounters.resetPosition(new Phaser.Math.Vector2(this.player.x, this.player.y));
  }

  private createUi(): void {
    this.add.rectangle(8, 8, 236, 16, 0xfacc15).setOrigin(0, 0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827);

    this.dialogueBox = new DialogueBox(this);
    this.statsPanel = new PlayerStatsPanel(this);

    this.battleStatusBox = this.add.rectangle(48, 78, 76, 92, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);
    this.battleStatusText = addPixelText(this, 16, 38, "", 7).setVisible(false);

    this.battleEnemyBox = this.add.rectangle(154, 84, 108, 62, 0x65a30d, 1)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);
    this.battleEnemySprite = this.add.sprite(154, 92, spriteFrames.dustBunny.texture, spriteFrames.dustBunny.frame)
      .setScale(2)
      .setVisible(false);
    this.battleEnemyText = addPixelText(this, 108, 56, "", 6)
      .setMaxWidth(96)
      .setVisible(false);

    this.commandBox = this.add.rectangle(256, 58, 120, 58, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);
    this.commandText = addPixelText(this, 204, 38, "", 7).setVisible(false);
  }

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    if (this.mode === "battle") {
      this.handleBattleTurn();
      return;
    }

    const playerPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.exit.x, this.exit.y), 24)) {
      this.startDialogue(
        dialogue.basementExit.map((text) => ({ speaker: "NARRATOR", text })),
        () => this.scene.start("NeighborhoodScene"),
      );
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.safetySticker.x, this.safetySticker.y), 28)) {
      this.startDialogue([
        { speaker: "NARRATOR", text: "A faded sticker reads: TURN OFF POWER BEFORE SERVICING ELECTRICAL APPLIANCE." },
        { speaker: "DAD'S BRAIN", text: "A lesser man would ignore that. Dad is occasionally not a lesser man." },
        { speaker: "DAD", text: "Fine. Breaker first. Heroics after." },
      ]);
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.breaker.x, this.breaker.y), 30)) {
      if (this.state.flags.circuitBreakerOff) {
        if (this.state.flags.bossDefeated) {
          this.state.flags.circuitBreakerOff = false;
          completeQuestStep(this.state, "restore-power");
          setActiveQuestStep(this.state, "return-to-wife");
          this.breakerSwitch
            .setY(this.breaker.y - 4)
            .setFillStyle(0xf97316);
          this.updateQuestText("BASEMENT");
          this.startDialogue([
            { speaker: "NARRATOR", text: "Dad flips the breaker back on. The house wakes up with a chorus of appliance beeps." },
            { speaker: "DAD'S BRAIN", text: "Dude. Dryers don't work without power." },
            { speaker: "DAD", text: "I knew that. I was creating suspense." },
          ]);
          return;
        }

        this.startDialogue([
          { speaker: "NARRATOR", text: "The breaker is off. The basement hum has dropped to a suspicious mutter." },
          { speaker: "DAD'S BRAIN", text: "Leave it off until the angry electrical appliance is done being angry." },
          { speaker: "DAD", text: "That probably means I did something right." },
        ]);
        return;
      }

      this.state.flags.circuitBreakerOff = true;
      completeQuestStep(this.state, "flip-breaker");
      setActiveQuestStep(this.state, "defeat-heating-coil");
      this.breakerSwitch
        .setY(this.breaker.y + 4)
        .setFillStyle(0x22c55e);
      this.updateQuestText("BASEMENT");
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: "Kill the power before poking the angry appliance. Revolutionary." },
        { speaker: "NARRATOR", text: "Dad flips the circuit breaker. The dryer coil loses its worst idea." },
        { speaker: "DAD", text: "Okay. Now the wrench gets to be the bad cop." },
      ]);
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.coil.x, this.coil.y), 28)) {
      if (this.state.flags.bossDefeated) {
        this.startDialogue([
          { speaker: "NARRATOR", text: "The heating coil is quiet now. Almost smugly quiet." },
        ]);
        return;
      }

      if (!this.state.flags.foundWrench) {
        setActiveQuestStep(this.state, "find-wrench");
        this.updateQuestText("BASEMENT");
        this.startDialogue([
          { speaker: "DAD'S BRAIN", text: getDadBrainLine("findWrench") },
          { speaker: "NARRATOR", text: "Dad sizes up the coil with his bare hands." },
          { speaker: "DAD", text: "Nope. This is a wrench problem." },
          { speaker: "DAD", text: getDadLine("selfTalk", "frustrated") },
          { speaker: "NARRATOR", text: "The garage waits. Unfortunately." },
        ], () => this.scene.start("NeighborhoodScene"));
        return;
      }

      const breakerWarning = this.state.flags.circuitBreakerOff
        ? []
        : [
          { speaker: "DAD'S BRAIN", text: "The breaker is still on. Baddass Zap is still very much on the menu." },
          { speaker: "NARRATOR", text: "The coil crackles with live current. Dad can still try, technically." },
        ];

      this.startDialogue([
        ...breakerWarning,
        ...dialogue.battleIntro.map((text) => ({ speaker: "NARRATOR", text })),
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("battle") },
        { speaker: "DAD", text: getDadLine("toEnemy", "battleStart") },
      ], () => this.startBattle("evil-heating-coil"));
      return;
    }

    this.startDialogue([
      { speaker: "NARRATOR", text: "The basement smells like cardboard, old paint, and obligation." },
    ]);
  }

  private startDialogue(lines: DialogueInput[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") {
      return;
    }

    const next = this.dialogueRunner.advance();

    if (next) {
      this.showMessage(next);
      return;
    }

    if (this.mode === "dialogue") {
      this.mode = "explore";
      this.hideMessage();
    }
  }

  private startBattle(enemyId: string): void {
    this.activeEnemyId = enemyId;
    const enemy = enemies.find((candidate) => candidate.id === enemyId);

    if (!enemy) {
      throw new Error(`Missing enemy definition: ${enemyId}`);
    }

    const snapshot = this.battle.start(enemy, this.state);
    this.mode = "battle";
    this.battlePhase = "command";
    this.selectedCommandIndex = 0;
    this.updateQuestText("BATTLE");
    this.showBattleUi(snapshot);

    if (snapshot.ambushed && snapshot.message) {
      this.battlePhase = "enemyResult";
      this.showMessage(snapshot.message, "AMBUSH");
      if (snapshot.defeated) {
        this.handleHeroDefeat(snapshot.message);
      }
      return;
    }

    this.showMessage(this.formatBattleSnapshot(snapshot), "BATTLE");
    this.showBattleMenu();
  }

  private handleBattleTurn(): void {
    if (this.dialogueBox.advance() !== "done") {
      return;
    }

    if (this.battlePhase === "enemyResult") {
      this.battlePhase = "command";
      const snapshot = this.battle.getSnapshot(this.state);
      this.updateBattlePanels(snapshot);
      this.showMessage(this.formatBattleSnapshot(snapshot), "BATTLE");
      this.showBattleMenu();
      return;
    }

    if (this.battlePhase === "playerResult") {
      const enemyResult = this.battle.useEnemyTurn(this.state);
      this.battlePhase = "enemyResult";
      this.updateBattlePanels(enemyResult);

      if (enemyResult.defeated) {
        this.handleHeroDefeat(enemyResult.message);
        return;
      }

      this.showMessage([
        enemyResult.message,
        getDadLine("toEnemy", this.isHeroLowHp(enemyResult) ? "lowHp" : "takingDamage"),
      ].join("\n"), "BATTLE");
      return;
    }

    const command = battleCommands[this.selectedCommandIndex];
    const result = this.resolveBattleCommand(command);
    this.updateBattlePanels(result);

    if (result.victory) {
      this.hideBattleMenu();
      this.handleBattleVictory(result.message);
      return;
    }

    if (result.escaped) {
      this.hideBattleMenu();
      this.handleBattleEscape(result.message);
      return;
    }

    this.battlePhase = "playerResult";
    this.hideBattleMenu();
    this.showMessage(result.message, "BATTLE");
  }

  private handleBattleVictory(resultMessage: string): void {
    if (this.activeEnemyId === "dust-bunny") {
      this.updateQuestText("BASEMENT");
      this.startDialogue([
        { speaker: "BATTLE", text: resultMessage },
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
        { speaker: "DAD", text: getDadLine("selfTalk", "victory") },
        { speaker: "NARRATOR", text: "The basement briefly seems less judgmental." },
      ], () => {
        this.hideBattleUi();
        this.mode = "explore";
        this.hideMessage();
      });
      return;
    }

    this.state.flags.bossDefeated = true;
    completeQuestStep(this.state, "defeat-heating-coil");
    setActiveQuestStep(this.state, this.state.flags.circuitBreakerOff ? "restore-power" : "return-to-wife");
    this.updateQuestText("VICTORY");
    this.startDialogue([
      { speaker: "BATTLE", text: resultMessage },
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
      { speaker: "DAD", text: getDadLine("selfTalk", "victory") },
      {
        speaker: "NARRATOR",
        text: this.state.flags.circuitBreakerOff
          ? "The vent stops rattling. The breaker, however, is still off."
          : "The vent stops rattling. Upstairs, a towel may yet become dry.",
      },
      ...(this.state.flags.circuitBreakerOff
        ? [{ speaker: "DAD'S BRAIN", text: "One last heroic act: turn the power back on before declaring victory." }]
        : []),
    ], () => {
      this.hideBattleUi();
      this.scene.start("NeighborhoodScene");
    });
  }

  private handleBattleEscape(resultMessage: string): void {
    this.updateQuestText("BASEMENT");
    this.randomEncounters.resetPosition(new Phaser.Math.Vector2(this.player.x, this.player.y));
    this.startDialogue([
      { speaker: "BATTLE", text: resultMessage },
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("basement") },
    ], () => {
      this.hideBattleUi();
      this.mode = "explore";
      this.hideMessage();
    });
  }

  private handleHeroDefeat(resultMessage: string): void {
    this.hideBattleMenu();
    this.updateQuestText("RECLINER");
    this.startDialogue([
      { speaker: "BATTLE", text: resultMessage },
      { speaker: "NARRATOR", text: "Everything goes white, then beige, then suspiciously recliner-shaped." },
      { speaker: "WIFE", text: "Why are you in the chair with a beer? The dryer is still broken." },
      { speaker: "WIFE", text: "My parents are not getting any younger, and neither is that laundry." },
      { speaker: "DAD'S BRAIN", text: this.getDefeatRecoveryHint() },
    ], () => {
      this.hideBattleUi();
      this.recoverFromHeroDefeat();
      this.scene.start("NeighborhoodScene");
    });
  }

  private recoverFromHeroDefeat(): void {
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.dadPoints = this.state.player.maxDadPoints;
    this.state.player.cash = Math.max(0, this.state.player.cash - 2);

    if (!this.state.flags.foundWrench) {
      setActiveQuestStep(this.state, "find-wrench");
      return;
    }

    if (!this.state.flags.circuitBreakerOff) {
      setActiveQuestStep(this.state, "flip-breaker");
      return;
    }

    setActiveQuestStep(this.state, "defeat-heating-coil");
  }

  private getDefeatRecoveryHint(): string {
    if (!this.state.flags.foundWrench) {
      return "New plan: find the wrench, then worry about appliance combat.";
    }

    if (!this.state.flags.circuitBreakerOff) {
      return "New plan: keep the wrench, turn off the breaker, then try heroics again.";
    }

    return "New plan: breaker stayed off. Heal up, keep the wrench, and go finish this.";
  }

  private resolveBattleCommand(command: BattleCommand) {
    if (command === "Fight") {
      return this.battle.useFight(this.state);
    }

    if (command === "Dad Skills") {
      return this.battle.useDadSkill(this.state);
    }

    if (command === "Items") {
      return this.battle.useItem(this.state, "ibuprofen");
    }

    return this.battle.useRun(this.state);
  }

  private updateBattleMenuSelection(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex - 2,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex + 2,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex - 1,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex + 1,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }
  }

  private showBattleMenu(): void {
    const commandLabel = (index: number) =>
      `${index === this.selectedCommandIndex ? ">" : " "}${this.getCommandLabel(battleCommands[index])}`;
    const menu = `${commandLabel(0).padEnd(8)} ${commandLabel(1)}\n${commandLabel(2).padEnd(8)} ${commandLabel(3)}`;

    this.commandBox.setVisible(true);
    setPixelText(this.commandText, menu);
    this.commandText.setVisible(true);
  }

  private hideBattleMenu(): void {
    this.commandBox.setVisible(false);
    this.commandText.setVisible(false);
  }

  private showBattleUi(snapshot: {
    enemy: { id: string; name: string; battleTexture?: string };
    enemyHp: number;
    enemyMaxHp: number;
    heroHp: number;
    heroMaxHp: number;
  }): void {
    this.battleStatusBox.setVisible(true);
    this.battleStatusText.setVisible(true);
    this.battleEnemyBox.setVisible(true);
    this.battleEnemySprite.setVisible(true);
    this.battleEnemyText.setVisible(true);
    this.updateBattlePanels(snapshot);
  }

  private hideBattleUi(): void {
    this.hideBattleMenu();
    this.battleStatusBox.setVisible(false);
    this.battleStatusText.setVisible(false);
    this.battleEnemyBox.setVisible(false);
    this.battleEnemySprite.setVisible(false);
    this.battleEnemyText.setVisible(false);
  }

  private updateBattlePanels(snapshot: {
    enemy: { id: string; name: string; battleTexture?: string };
    enemyHp: number;
    enemyMaxHp: number;
    heroHp: number;
    heroMaxHp: number;
  }): void {
    const player = this.state.player;
    setPixelText(
      this.battleStatusText,
      `${player.name || "DAD"}\nLV ${player.level}\nHP ${snapshot.heroHp}/${snapshot.heroMaxHp}\nDP ${player.dadPoints}/${player.maxDadPoints}\nLOVE ${player.cash}\nXP ${player.xp}`,
    );
    setPixelText(
      this.battleEnemyText,
      `${this.getBattleEnemyLabel(snapshot.enemy.id, snapshot.enemy.name)}\nHP ${snapshot.enemyHp}/${snapshot.enemyMaxHp}`,
    );

    if (snapshot.enemy.battleTexture) {
      const spriteSize = this.getBattleEnemySpriteSize(snapshot.enemy.id);
      this.battleEnemySprite
        .setTexture(snapshot.enemy.battleTexture)
        .setPosition(154, spriteSize.y)
        .setDisplaySize(spriteSize.width, spriteSize.height);
      return;
    }

    this.battleEnemySprite
      .setTexture(spriteFrames.dustBunny.texture, spriteFrames.dustBunny.frame)
      .setPosition(154, 92)
      .setDisplaySize(32, 32);
  }

  private getBattleEnemyLabel(enemyId: string, fallbackName: string): string {
    if (enemyId === "evil-heating-coil") {
      return "HEATING COIL";
    }

    return fallbackName;
  }

  private getBattleEnemySpriteSize(enemyId: string): { width: number; height: number; y: number } {
    if (enemyId === "evil-heating-coil") {
      return { width: 38, height: 34, y: 94 };
    }

    return { width: 32, height: 32, y: 93 };
  }

  private getCommandLabel(command: BattleCommand): string {
    if (command === "Dad Skills") {
      return "SKILL";
    }

    return command.toUpperCase();
  }

  private checkRandomEncounter(): void {
    const encounter = this.randomEncounters.update(
      new Phaser.Math.Vector2(this.player.x, this.player.y),
      this.state,
    );

    if (!encounter) {
      return;
    }

    this.startDialogue([
      ...encounter.introMessages.map((text) => ({ speaker: "NARRATOR", text })),
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("battle") },
      { speaker: "DAD", text: getDadLine("toEnemy", "battleStart") },
    ], () => this.startBattle(encounter.enemy.id));
  }

  private isHeroLowHp(snapshot: { heroHp: number; heroMaxHp: number }): boolean {
    return snapshot.heroHp <= snapshot.heroMaxHp * 0.3;
  }

  private formatBattleSnapshot(snapshot: {
    enemy: { name: string };
    enemyHp: number;
    enemyMaxHp: number;
    heroHp: number;
    heroMaxHp: number;
  }): string {
    return "Command?";
  }

  private updateQuestText(prefix: string): void {
    setPixelText(
      this.questText,
      `${prefix} - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`,
    );
  }

  private showMessage(message: DialogueLine | string, speaker = "DAD"): void {
    const line = typeof message === "string" ? { speaker, text: message } : message;
    this.dialogueBox.show(line.text, this.getSpeakerLabel(line.speaker));
  }

  private hideMessage(): void {
    this.dialogueRunner.clear();
    this.dialogueBox.hide();
  }

  private getSpeakerLabel(speaker: string): string {
    return speaker === "DAD" ? this.state.player.name || "DAD" : speaker;
  }

}

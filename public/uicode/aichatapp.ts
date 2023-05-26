import GameBaseApp from "./gamebaseapp.js";
declare const firebase: any;
declare const window: any;

/** Guess app class */
export class AIChatApp extends GameBaseApp {
  apiType = "aichat";
  match_start: any = document.querySelector(".match_start");
  currentGame: any;
  gameSubscription: any;

  /**  */
  constructor() {
    super();

  }
  /** BaseApp override to paint profile specific authorization parameters */
  authUpdateStatusUI() {
    super.authUpdateStatusUI();
    this.currentGame = null;
    this.gameid_span.innerHTML = "";
    this.initRTDBPresence();

    const gameId = this.urlParams.get("game");
    if (gameId) {
      this.gameAPIJoin(gameId);
      this.currentGame = gameId;
      this.gameid_span.innerHTML = this.currentGame;

      if (this.gameSubscription) this.gameSubscription();
      this.gameSubscription = firebase.firestore().doc(`Games/${this.currentGame}`)
        .onSnapshot((doc: any) => this.paintGameData(doc));
    }
  }
  /** paint game data (game document change handler)
   * @param { any } gameDoc firestore query snapshot
   */
  paintGameData(gameDoc: any = null) {
    if (gameDoc) this.gameData = gameDoc.data();
    if (!this.gameData) return;
    if (!this.allBeers) return;

    if (this.wheelPosition === -1 && this.gameData.wheelPosition) this.wheelPosition = this.gameData.wheelPosition;
    if (this.gameData.turnPhase === "spin" && this.gameData.turnNumber === 0) {
      this.wheelPosition = this.gameData.wheelPosition;
    }

    this.queryStringPaintProcess();
    this.paintOptions(false);
    this._updateGameMembersList();
    this._updateFinishStatus();
    this.updateUserPresence();
  }
  /** show/hide members list
   * @param { any } e event to prevent default
   */
  toggleOptionsView(e: any) {
    if (document.body.classList.contains("show_game_table")) {
      document.body.classList.remove("show_game_table");
      document.body.classList.add("show_game_members");
      this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">close</i>";
    } else {
      document.body.classList.add("show_game_table");
      document.body.classList.remove("show_game_members");
      this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">menu</i>";
    }
    if (e) e.preventDefault();
  }
}

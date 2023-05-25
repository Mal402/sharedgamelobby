import * as firebaseAdmin from "firebase-admin";
import BaseClass from "./baseclass";
import GameAPI from "./gameapi";

/** Match game specific turn logic wrapped in a transaction */
export default class MatchAPI {
  /** returns matched pair count for a game data object
   * @param { any } gameData storage object
   * @return { number } number of pairs
   */
  static _matchedPairCount(gameData: any) {
    let count = 0;
    for (let index = 0; index < gameData.cardCount; index++) {
      if (gameData.cardIndexesRemoved[index]) count++;
    }

    return count / 2;
  }
  /** using updatepacket to update storage object score in place
   * @param { any } gameData storage object
   * @param { any } updatePacket user action info
   * @param { boolean } newMatch true to init points
   */
  static _updatePoints(gameData: any, updatePacket: any, newMatch: boolean) {
    const seatIndex = gameData.currentSeat.toString();
    const currentPts = gameData["seatPoints" + seatIndex];

    let pts = 0;
    if (newMatch) {
      updatePacket.pairsInARowMatched = gameData.pairsInARowMatched + 1;

      if (gameData.scoringSystem === "simple") {
        pts = 1;
      } else if (gameData.scoringSystem === "stable") {
        pts = 2;
      } else if (gameData.scoringSystem === "regular") {
        pts = 2;
        const matchedPairs = MatchAPI._matchedPairCount(gameData);

        if (matchedPairs === 0) pts = 5;
        if (updatePacket.pairsInARowMatched * 2 > pts) pts = updatePacket.pairsInARowMatched * 2;
      }
      updatePacket.previousMatch = true;
    }

    let newShows = 0;
    if (updatePacket.previousCard0 !== undefined && updatePacket.previousCard0 !== null) {
      if (!gameData.cardIndexesShown[updatePacket.previousCard0]) newShows++;
    }

    if (updatePacket.previousCard1 !== undefined && updatePacket.previousCard1 !== null) {
      if (!gameData.cardIndexesShown[updatePacket.previousCard1]) newShows++;
    }

    if (gameData.scoringSystem === "simple") newShows = 0;

    updatePacket["seatPoints" + seatIndex] = currentPts + pts + newShows;

    let winningSeatIndex = 0;
    let winningPointsTotal = 0;
    for (let c = 0; c < gameData.runningNumberOfSeats; c++) {
      let pts = gameData["seatPoints" + c];
      if (c.toString() === seatIndex) pts = updatePacket["seatPoints" + c];

      if (winningPointsTotal <= pts) {
        winningPointsTotal = pts;
        winningSeatIndex = c;
      }
    }

    updatePacket["winningSeatIndex"] = winningSeatIndex;
    updatePacket["winningPointsTotal"] = winningPointsTotal;
  }
  /** create delta for user action to apply to game storage object
   * @param { any } gameData storage object
   * @param { string } uid user id
   * @param { any } localInstance server options
   * @param { string } action action description
   * @param { number } card0 first selected card index (-1 for none)
   * @param { number } card1 second selected card index (-1 for none)
   * @return { Promise<any> } updatePacket to apply to game storage object
   */
  static async _processUserAction(gameData: any, uid: string, localInstance: any, action: string,
    card0: number, card1: number): Promise<any> {
    const isOwner = (uid === gameData.createUser);
    const currentUser = gameData["seat" + gameData.currentSeat];
    const currentPlayer = (uid === currentUser);

    const updatePacket: any = {};
    if (action === "startGame") {
      if (!isOwner) throw new Error("Must own game to start");

      if (GameAPI._emptySeat(gameData)) throw new Error("Can't start with empty seats");

      const cardCount = gameData.numberOfSeats < 3 ? 16 : 24;
      const cardIndexOrder = GameAPI._shuffleNumberArray(cardCount);
      updatePacket.cardIndexOrder = cardIndexOrder;

      updatePacket.mode = "running";
      updatePacket.cardIndexesShown = {};
      updatePacket.seat0Totals = {};
      updatePacket.seat1Totals = {};
      updatePacket.seat2Totals = {};
      updatePacket.seat3Totals = {};
      updatePacket.seatPoints0 = 0;
      updatePacket.seatPoints1 = 0;
      updatePacket.seatPoints2 = 0;
      updatePacket.seatPoints3 = 0;
      updatePacket.pairsInARowMatched = 0;
      updatePacket.cardIndexesRemoved = {};
      updatePacket.gameFinished = false;
      updatePacket.previousCard0 = -1;
      updatePacket.previousCard1 = -1;
      updatePacket.previousMatch = false;
      updatePacket.cardCount = cardCount;
      updatePacket.turnNumber = 0;
      updatePacket.currentSeat = 0;
      updatePacket.turnPhase = "select"; // result, clearprevious
      updatePacket.runningNumberOfSeats = gameData.numberOfSeats;
      updatePacket.selectionMatched = false;

      for (let c = 0; c < cardCount; c++) {
        updatePacket.cardIndexesShown[c.toString()] = false;
        updatePacket.cardIndexesRemoved[c.toString()] = false;
      }
    }
    if (action === "endGame") {
      if (!isOwner) throw new Error("Must own game to end");

      updatePacket.mode = "end";
    }
    if (action === "resetGame") {
      if (!isOwner) throw new Error("Must own game to reset");

      updatePacket.mode = "ready";
    }
    if (action === "sendSelection") {
      if (!currentPlayer) throw new Error("Must be current player");

      if (gameData.turnPhase === "select") {
        if (gameData.previousCard0 === card1) throw new Error("Can't select same card twice");

        if (gameData.previousCard0 < 0) throw new Error("no first card selected");

        const card0Value = gameData.cardIndexOrder[gameData.previousCard0];
        const card1Value = gameData.cardIndexOrder[card1];

        const deckIndex0 = card0Value % (gameData.cardCount / 2);
        const deckIndex1 = card1Value % (gameData.cardCount / 2);

        updatePacket.selectionMatched = (deckIndex0 === deckIndex1);
        updatePacket.previousCard1 = card1;
        if (updatePacket.selectionMatched) {
          updatePacket.lastMatchIndex = deckIndex0;
        }

        MatchAPI._updatePoints(gameData, updatePacket, updatePacket.selectionMatched);

        updatePacket.cardIndexesShown = {};
        updatePacket.cardIndexesShown = {
          [updatePacket.previousCard1]: true,
        };

        updatePacket.turnPhase = "result";
      } else throw new Error("Turn Phase is not in select");
    }
    if (action === "endTurn") {
      if (!currentPlayer) throw new Error("Must be current player");

      if (gameData.turnPhase === "result") {
        updatePacket.turnPhase = "clearprevious";
        if (!gameData.turnNumber) gameData.turnNumber = 0;
        if (!gameData.previousMatch) {
          updatePacket.turnNumber = gameData.turnNumber + 1;
          updatePacket.pairsInARowMatched = 0;
        } else {
          updatePacket.cardIndexesRemoved = {
            [gameData.previousCard0]: true,
            [gameData.previousCard1]: true,
          };

          const matchedPairs = MatchAPI._matchedPairCount(gameData) + 1;
          updatePacket.turnNumber = gameData.turnNumber;
          updatePacket.previousMatch = false;
          if (matchedPairs === gameData.cardCount / 2) {
            updatePacket.mode = "end";
            updatePacket.gameFinished = true;
          }
        }

        updatePacket.currentSeat = updatePacket.turnNumber % gameData.runningNumberOfSeats;
        const nextUser = gameData["seat" + updatePacket.currentSeat];
        if (nextUser) {
          if (!updatePacket.members) updatePacket.members = {};
          updatePacket.members[nextUser] = new Date().toISOString();
        }
      } else throw new Error("Turn Phase is not in result");
    }
    if (action === "updateSelection") {
      if (!currentPlayer) throw new Error("Must be current player");

      if (gameData.turnPhase === "select") {
        updatePacket.previousCard0 = card0;
        MatchAPI._updatePoints(gameData, updatePacket, false);

        updatePacket.cardIndexesShown = {};
        updatePacket.cardIndexesShown = {
          [updatePacket.previousCard0]: true,
        };
      } else throw new Error("Turn Phase is not in select");
    }
    if (action === "clearSelection") {
      if (!currentPlayer) throw new Error("Must be current player");

      if (gameData.turnPhase === "clearprevious") {
        updatePacket.turnPhase = "select";
        updatePacket.previousCard0 = -1;
        updatePacket.previousCard1 = -1;
        updatePacket.selectionMatched = false;
      } else throw new Error("Turn Phase is not in clear previous");
    }

    return updatePacket;
  }
  /** http endpoint for sit at game table
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async userAction(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();

    const gameId = req.body.gameId;
    const action = req.body.action;
    const card0 = req.body.previousCard0;
    const card1 = req.body.previousCard1;

    try {
      const gQuery = firebaseAdmin.firestore().doc(`Games/${gameId}`);
      await firebaseAdmin.firestore().runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(gQuery);
        if (!sfDoc.exists) {
          throw new Error("Game does not exist");
        }
        const gameData = sfDoc.data();

        const updatePacket = await MatchAPI._processUserAction(gameData, uid, localInstance, action, card0, card1);

        if (Object.keys(updatePacket).length > 0) {
          updatePacket.lastActivity = new Date().toISOString();
          if (!updatePacket.members) updatePacket.members = {};
          updatePacket.members[uid] = new Date().toISOString();

          transaction.set(gQuery, updatePacket, {
            merge: true,
          });
        }
      });
    } catch (e: any) {
      console.log("Transaction failed: ", e);
      return BaseClass.respondError(res, e.message);
    }

    return res.status(200).send({
      success: true,
    });
  }
}

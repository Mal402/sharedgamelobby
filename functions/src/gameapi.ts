import * as firebaseAdmin from "firebase-admin";
import BaseClass from "./baseclass";
import fetch from "node-fetch";

/** GameAPI for managing game records and base functions for 2D games */
export default class GameAPI {
  /** creates default game
   * @param { string } uid game value
   * @return { any } object with default game values
   */
  static _defaultGame(uid: string): any {
    return {
      createUser: uid,
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      mode: "ready", // running, end
      icon: "",
      image: "",
      background: "",
      color: "",
      turnNumber: 0,
      currentSeat: 0,
      playerTurn: 0,
      turnPhase: "init",
      previousCard0: -1,
      previousCard1: -1,
      numberOfSeats: 2,
      runningNumberOfSeats: 2,
      cardDeck: "empyrean",
      visibility: "private",
      messageLevel: "seated",
      publicStatus: "privateClosed",
      gameFinished: false,
      seat0: null,
      seat1: null,
      seat2: null,
      seat3: null,
      seat0Totals: {},
      seat1Totals: {},
      seat2Totals: {},
      seat3Totals: {},
      seatPoints0: 0,
      seatPoints1: 0,
      seatPoints2: 0,
      seatPoints3: 0,
      pairsInARowMatched: 0,
      scoringSystem: "regular",
      seatsPerUser: "one",
      cardsShown: {},
      members: {},
      memberNames: {},
      memberImages: {},
      cardIndexOrder: [],
      sectors: [],
      solutionText: "",
    };
  }
  /** grabs random valid beer slug
   * @return { string } beerSlug
  */
  static async _getRandomBeerSlug(): Promise<string> {
    const response = <any>await fetch(`https://${process.env.GCLOUD_PROJECT}.web.app/data/beerMap.json`);
    const beerMap = <any>await response.json();
    const beerSlugs = Object.keys(beerMap);
    const randomBeer = Math.floor(Math.random() * beerSlugs.length);
    const beerSlug = beerSlugs[randomBeer];

    return beerSlug;
  }
  /** gets a unique 5 digit game slug
   * @param { any } collection gametype store name
   * @return { string } 5 digit game slug
   */
  static async _getUniqueGameSlug(collection: string): Promise<string> {
    /** get a single random digit
     * @return { string } single digit
     */
    function getDigit() {
      let char = "a";
      const charNum = Math.floor(Math.random() * 35);
      if (charNum < 10) char = charNum.toString();
      else char = String.fromCharCode(charNum - 10 + "a".charCodeAt(0));

      return char;
    }

    let slug = "";
    const numDigits = 5;
    for (let c = 0; c < numDigits; c++) slug += getDigit();

    const gameTest = await firebaseAdmin.firestore().doc(`${collection}/${slug}`).get();
    if (gameTest.data()) {
      return GameAPI._getUniqueGameSlug(collection);
    }

    return slug;
  }
  /** recursive delete collection in batches
   * @param { any } db firestore db instance
   * @param { string } collectionPath path
   * @param { number } batchSize number of documents to delete per recursive call (batch)
   * @return { any } promise that resolves once collection is deleted
   */
  static async deleteCollection(db: any, collectionPath: string, batchSize: number): Promise<any> {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy("__name__").limit(batchSize);

    return new Promise((resolve, reject) => {
      GameAPI.deleteQueryBatch(db, query, resolve).catch(reject);
    });
  }
  /** internal delete query batch call (calls resolve when complete)
   * @param { any } db firestore db instance
   * @param { any } query delete firestore query object
   * @param { function } resolve resolve function for promise
  */
  static async deleteQueryBatch(db: any, query: any, resolve: any) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
      // When there are no documents left, we are done
      resolve();
      return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
      GameAPI.deleteQueryBatch(db, query, resolve);
    });
  }
  /** random set of indexes for an array
   * @param { number } length length of generate index array
   * @return { Array } of integer based indexes to randomize array order
  */
  static _shuffleNumberArray(length: number): Array<number> {
    /** randomize an array
    * @param { Array } array array to randomize element order
    * @return { Array } result
    */
    function _shuffleArray(array: Array<number>): Array<number> {
      let currentIndex = array.length;
      while (0 !== currentIndex) {
        const randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [
          array[randomIndex], array[currentIndex],
        ];
      }
      return array;
    }

    let cardIndexOrder = [];
    for (let c = 0; c < length; c++) cardIndexOrder.push(c);

    cardIndexOrder = _shuffleArray(cardIndexOrder);
    return cardIndexOrder;
  }
  /** http endpoint for create game
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async create(req: any, res: any): Promise<any> {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();
    const userQ = await firebaseAdmin.firestore().doc(`Users/${uid}`).get();
    const profile = userQ.data();
    if (!profile) {
      return BaseClass.respondError(res, "User not found");
    }

    const game = GameAPI._defaultGame(uid);
    const beerSlug = await GameAPI._getRandomBeerSlug();
    game.beerSlug = beerSlug;
    game.letters = "";
    game.numberOfSeats = 2;
    if (req.body.numberOfSeats) game.numberOfSeats = Number(req.body.numberOfSeats);
    game.gameType = "guess";
    if (req.body.gameType) game.gameType = req.body.gameType;
    game.visibility = "private";
    game.messageLevel = "seated";
    if (req.body.messageLevel) game.messageLevel = req.body.messageLevel;
    if (req.body.visibility) game.visibility = req.body.visibility;
    if (req.body.scoringSystem) game.scoringSystem = req.body.scoringSystem;
    if (req.body.seatsPerUser) game.seatsPerUser = req.body.seatsPerUser;
    if (req.body.cardDeck) game.cardDeck = req.body.cardDeck;

    game.publicStatus = GameAPI._publicStatus(game);

    const gameNumber = await GameAPI._getUniqueGameSlug("Games");
    game.gameNumber = gameNumber;

    let displayName = BaseClass.escapeHTML(profile.displayName);
    let displayImage = profile.displayImage;

    if (!displayName) displayName = "Anonymous";
    if (!displayImage) displayImage = "";

    game.members = {
      [uid]: new Date().toISOString(),
    };
    game.memberNames = {
      [uid]: displayName,
    };
    game.memberImages = {
      [uid]: displayImage,
    };
    await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).set(game);

    return res.status(200).send({
      success: true,
      game,
      gameNumber,
    });
  }
  /** http endpoint for delete game
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async delete(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();

    const gameNumber = req.body.gameNumber;

    const gameDataRef = firebaseAdmin.firestore().doc(`Games/${gameNumber}`);
    const gameDataQuery = await gameDataRef.get();
    const gameData = gameDataQuery.data();
    let success = false;
    if (gameData && gameData.createUser === uid) {
      await gameDataRef.delete();
      await GameAPI.deleteCollection(firebaseAdmin.firestore(), `Games/${gameNumber}/messages`, 50);
      success = true;
    }

    return res.status(200).send({
      success,
    });
  }
  /** http endpoint for game options update
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async options(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;
    const gameNumber = req.body.gameNumber;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();

    const gameQuery = await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).get();
    const gameData = gameQuery.data();
    if (!gameData) {
      return BaseClass.respondError(res, "Game not found");
    }

    const userQ = await firebaseAdmin.firestore().doc(`Users/${uid}`).get();
    const profile = userQ.data();
    if (!profile) {
      return BaseClass.respondError(res, "User not found");
    }

    if (uid !== gameData.createUser) {
      return BaseClass.respondError(res, "User must be owner to set options");
    }

    const updatePacket: any = {};
    if (req.body.visibility) {
      const visibility = req.body.visibility;
      if (gameData.visibility !== visibility) {
        updatePacket.visibility = visibility;
        gameData.visibility = visibility;
      }
    }

    if (req.body.numberOfSeats) {
      const numberOfSeats = req.body.numberOfSeats;
      if (gameData.numberOfSeats !== numberOfSeats) {
        // clear out new seats
        for (let c = gameData.numberOfSeats; c < numberOfSeats; c++) {
          updatePacket["seat" + c.toString()] = null;
          gameData["seat" + c.toString()] = null;
        }
        updatePacket.numberOfSeats = numberOfSeats;
        gameData.numberOfSeats = numberOfSeats;
        if (gameData.mode !== "running") gameData.runningNumberOfSeats = numberOfSeats;
      }
    }

    if (req.body.messageLevel) {
      const messageLevel = req.body.messageLevel;
      if (gameData.messageLevel !== messageLevel) {
        updatePacket.messageLevel = messageLevel;
        gameData.messageLevel = messageLevel;
      }
    }

    if (req.body.cardDeck) {
      const cardDeck = req.body.cardDeck;
      if (gameData.cardDeck !== cardDeck) {
        updatePacket.cardDeck = cardDeck;
        gameData.cardDeck = cardDeck;
      }
    }

    if (req.body.scoringSystem) {
      const scoringSystem = req.body.scoringSystem;
      if (gameData.scoringSystem !== scoringSystem) {
        updatePacket.scoringSystem = scoringSystem;
        gameData.scoringSystem = scoringSystem;
      }
    }

    if (req.body.seatsPerUser) {
      const seatsPerUser = req.body.seatsPerUser;
      if (gameData.seatsPerUser !== seatsPerUser) {
        updatePacket.seatsPerUser = seatsPerUser;
        gameData.seatsPerUser = seatsPerUser;
      }
    }

    updatePacket.publicStatus = GameAPI._publicStatus(gameData);

    await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).set(updatePacket, {
      merge: true,
    });

    return res.status(200).send({
      success: true,
    });
  }
  /** http endpoint for join game refreshes user display name, image and member: date
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async join(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;
    const gameNumber = req.body.gameNumber;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();

    const gameData = await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).get();
    if (!gameData.data()) {
      return BaseClass.respondError(res, "Game not found");
    }

    const userQ = await firebaseAdmin.firestore().doc(`Users/${uid}`).get();
    const profile = userQ.data();
    if (!profile) {
      return BaseClass.respondError(res, "User not found");
    }

    let displayName = BaseClass.escapeHTML(profile.displayName);
    let displayImage = profile.displayImage;

    if (!displayName) displayName = "Anonymous";
    if (!displayImage) displayImage = "";

    const updatePacket = {
      members: {
        [uid]: new Date().toISOString(),
      },
      memberNames: {
        [uid]: displayName,
      },
      memberImages: {
        [uid]: displayImage,
      },
      lastActivity: new Date().toISOString(),
    };

    await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).set(updatePacket, {
      merge: true,
    });

    return res.status(200).send({
      success: true,
    });
  }
  /** http endpoint for leave game
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async leave(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;
    const gameNumber = req.body.gameNumber;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();

    const gameData = await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).get();
    if (!gameData.data()) {
      return BaseClass.respondError(res, "Game not found");
    }

    const game: any = gameData.data();
    if (uid === game.createUser) return BaseClass.respondError(res, "Owner has to stay in game");

    const updatePacket: any = {
      members: {
        [uid]: firebaseAdmin.firestore.FieldValue.delete(),
      },
    };
    for (let c = 0, l = game.numberOfSeats; c < l; c++) {
      if (game["seat" + c.toString()] === uid) updatePacket["seat" + c.toString()] = null;
    }

    await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).set(updatePacket, {
      merge: true,
    });

    return res.status(200).send({
      success: true,
    });
  }
  /** http endpoint for sit at game table
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async sit(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();
    const gameNumber = req.body.gameNumber;
    const db = firebaseAdmin.firestore();

    try {
      const gQuery = await firebaseAdmin.firestore().doc(`Games/${gameNumber}`);
      await db.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(gQuery);
        if (!sfDoc.exists) {
          throw new Error("Game does not exist");
        }
        const gameData: any = sfDoc.data();

        const seatIndex = Number(req.body.seatIndex);
        if (isNaN(seatIndex) || seatIndex < 0 && seatIndex >= gameData.numberOfSeats) throw new Error("Seat index invalid");

        const seatKey = "seat" + seatIndex.toString();
        if (gameData[seatKey]) {
          if (gameData[seatKey] === uid) throw new Error("already seated");

          throw new Error("someone else seated");
        } else {
          if (gameData.seatsPerUser === "one") {
            for (let seatIndex = 0; seatIndex < gameData.numberOfSeats; seatIndex++) {
              if (gameData["seat" + seatIndex.toString()] === uid) throw new Error("already seated in a different seat");
            }
          }

          gameData[seatKey] = uid;
          const publicStatus = GameAPI._publicStatus(gameData);

          transaction.set(gQuery, {
            [seatKey]: uid,
            publicStatus,
            lastActivity: new Date().toISOString(),
          }, {
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
  /** http endpoint for stand up from game table
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async stand(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();
    const gameNumber = req.body.gameNumber;
    const db = firebaseAdmin.firestore();

    try {
      const gQuery = firebaseAdmin.firestore().doc(`Games/${gameNumber}`);
      await db.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(gQuery);
        if (!sfDoc.exists) {
          throw new Error("Game does not exist");
        }
        const gameData: any = sfDoc.data();

        const seatIndex = Number(req.body.seatIndex);
        if (isNaN(seatIndex) || seatIndex < 0 && seatIndex >= gameData.numberOfSeats) throw new Error("Seat index invalid");

        const seatKey = "seat" + seatIndex.toString();
        if (gameData[seatKey]) {
          if (gameData[seatKey] !== uid && gameData.createUser !== uid) throw new Error("user not seated");

          gameData[seatKey] = null;
          const publicStatus = GameAPI._publicStatus(gameData);

          transaction.set(gQuery, {
            [seatKey]: null,
            publicStatus,
            lastActivity: new Date().toISOString(),
          }, {
            merge: true,
          });
        } else {
          throw new Error("no user seated");
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
  /** http endpoint for user posting message to table chat
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async message(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;
    const gameNumber = req.body.gameNumber;
    let message = BaseClass.escapeHTML(req.body.message);
    if (message.length > 1000) message = message.substr(0, 1000);

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();

    const gameQuery = await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).get();
    const gameData = gameQuery.data();
    if (!gameData) {
      return BaseClass.respondError(res, "Game not found");
    }

    const userQ = await firebaseAdmin.firestore().doc(`Users/${uid}`).get();
    const profile = userQ.data();
    if (!profile) {
      return BaseClass.respondError(res, "User not found");
    }

    const isOwner = uid === gameData.createUser;
    let isSeated = false;
    for (let c = 0; c < gameData.numberOfSeats; c++) {
      if (gameData["seat" + c.toString()] === uid) {
        isSeated = true;
        break;
      }
    }

    if (!isOwner) {
      if (gameData.messageLevel === "seated") {
        if (!isSeated) {
          return BaseClass.respondError(res, "User needs to be seated to chat");
        }
      }

      if (!gameData.members[uid]) {
        return BaseClass.respondError(res, "User needs to be a game member to chat");
      }
    }
    const memberImage = gameData.memberImages[uid] ? gameData.memberImages[uid] : "";
    const memberName = gameData.memberNames[uid] ? gameData.memberNames[uid] : "";

    const messagePacket = {
      uid,
      message,
      created: new Date().toISOString(),
      messageType: "user",
      gameNumber,
      isSeated,
      isOwner,
      memberName,
      memberImage,
    };

    await firebaseAdmin.firestore().collection(`Games/${gameNumber}/messages`).add(messagePacket);

    return res.status(200).send({
      success: true,
    });
  }
  /** http endpoint for user deleting message from user chat
   * @param { any } req http request object
   * @param { any } res http response object
   */
  static async messageDelete(req: any, res: any) {
    const authResults = await BaseClass.validateCredentials(req.headers.token);
    if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

    const uid = authResults.uid;

    const localInstance = BaseClass.newLocalInstance();
    await localInstance.init();

    const gameNumber = req.body.gameNumber;
    const messageId = req.body.messageId;

    const gameDataRef = firebaseAdmin.firestore().doc(`Games/${gameNumber}`);
    const gameDataQuery = await gameDataRef.get();
    const gameData = gameDataQuery.data();

    if (!gameData) return BaseClass.respondError(res, "Game not found");

    const isGameOwner = (gameData.createUser === uid);

    const messageQuery = await firebaseAdmin.firestore().doc(`Games/${gameNumber}/messages/${messageId}`).get();
    const message: any = messageQuery.data();

    const isOwner = (message.uid === uid);
    if (!isOwner && !isGameOwner) return BaseClass.respondError(res, "Must own game or message to delete");

    await firebaseAdmin.firestore().doc(`Games/${gameNumber}/messages/${messageId}`).delete();

    return res.status(200).send({
      success: true,
    });
  }
  /** get public status string sortable string
   * @param { any } game game data
   * @return { string } sortable game type and status string
   */
  static _publicStatus(game: any): string {
    const emptySeat = GameAPI._emptySeat(game) ? "Open" : "Full";
    return game.visibility + emptySeat;
  }
  /** check if any seats are empty
   * @param { any } game game data object
   * @return { boolean } true if available set
   */
  static _emptySeat(game: any): boolean {
    for (let c = 0; c < game.numberOfSeats; c++) {
      if (game["seat" + c.toString()] === null) return true;
    }
    return false;
  }
  /** trigger function for user meta change
   * @param { any } change after trigger change dictionary
   * @param { any } context of trigger call
   */
  static async updateUserMetaData(change: any, context: any) {
    let before = change.before.data();
    const after = change.after.data();
    if (!before) before = {};
    if (!after) return;
    const nameChange = (before.displayName !== after.displayName);
    const imageChange = (before.displayImage !== after.displayImage);

    if (nameChange) {
      await GameAPI._updateMetaNameForUser(context.params.uid);
    }
    if (imageChange) {
      await GameAPI._updateMetaImageForUser(context.params.uid);
    }
  }
  /** update all game records with udpated name for user
   * @param { string } uid user id
   */
  static async _updateMetaNameForUser(uid: string) {
    const freshUser = <any>await firebaseAdmin.firestore().doc(`Users/${uid}`).get();

    let name: string = freshUser.data().displayName;
    if (!name) name = "Anonymous";

    const gamesQuery = await firebaseAdmin.firestore().collection(`Games`)
      .where("members." + uid, ">", "").get();

    const promises: Array<any> = [];
    gamesQuery.docs.forEach((doc) => {
      promises.push(firebaseAdmin.firestore().collection(`Games`).doc(doc.id).set({
        memberNames: {
          [uid]: name,
        },
      }, {
        merge: true,
      }));
    });

    await Promise.all(promises);

    return;
  }
  /** update all game records with udpated image for user
   * @param { string } uid user id
   */
  static async _updateMetaImageForUser(uid: string) {
    const freshUser = <any>await firebaseAdmin.firestore().doc(`Users/${uid}`).get();

    let image: string | null | undefined = freshUser.data().displayImage;
    if (!image) image = "/images/defaultprofile.png";

    const gamesQuery = await firebaseAdmin.firestore().collection(`Games`)
      .where("members." + uid, ">", "").get();

    const promises: Array<any> = [];
    gamesQuery.docs.forEach((doc) => {
      promises.push(firebaseAdmin.firestore().collection(`Games`).doc(doc.id).set({
        memberImages: {
          [uid]: image,
        },
      }, {
        merge: true,
      }));
    });

    await Promise.all(promises);

    return;
  }
}

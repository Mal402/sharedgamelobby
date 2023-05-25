import fetch from "node-fetch";
import * as firebaseAdmin from "firebase-admin";
import BaseClass from "./baseclass";
import GameAPI from "./gameapi";
const rand = (m: number, M: number) => Math.random() * (M - m) + m;

/** Guess specific logic - user turn actions applied to game storage data in transaction */
export default class GuessAPI {
  static vowelLetters = "AEIOU";
  static constLetters = "BCDFGHJKLMNPQRSTVWXYZ";
  /** get compiled beer data
   * @return { Promise<any> } seoData compiled blob
   */
  static async getMainData(): Promise<any> {
    const response: any = await fetch(`https://${process.env.GCLOUD_PROJECT}.web.app/data/seodatablob.json`);
    return await response.json();
  }
  /** Full name for beerSlug data
   * @param { any } brewery
   * @param { any } beerData
   * @return { string } full beer name
   */
  static gameNameForBeer(brewery: any, beerData: any): string {
    let name = beerData.name;
    if (!name) name = "Missing Name";
    let bName = brewery.name;
    if (beerData.breweryName) bName = beerData.breweryName;

    return bName + " " + name;
  }
  /** using updatepacket to update storage object score in place
   * @param { any } gameData storage object
   * @param { any } updatePacket user action info
   * @param { string } letter true to init points
   */
  static _updatePoints(gameData: any, updatePacket: any, letter: string) {
    if (gameData.correctLetters.indexOf(letter) !== -1) throw new Error("Letter already selected");
    updatePacket.correctLetters = gameData.correctLetters;

    const seatIndex = gameData.currentSeat.toString();
    const currentPts = gameData["seatPoints" + seatIndex];

    let pts = 0;
    const isVowel = GuessAPI.vowelLetters.indexOf(letter.toUpperCase()) !== -1;
    const solutionText = gameData.solutionText.replaceAll(" ", "").replaceAll("'", "").toUpperCase();
    const correctLetterChars: Array<string> = Array.from(solutionText);
    const selectedLetterCounts: any = {};
    correctLetterChars.forEach((char: any) => {
      if (char !== " ") {
        char = char.toUpperCase();
        if (!selectedLetterCounts[char]) {
          selectedLetterCounts[char] = 0;
        }
        selectedLetterCounts[char]++;
      }
    });

    if (solutionText.indexOf(letter.toUpperCase()) !== -1) {
      updatePacket.correctLetters += letter;

      const sectorIndex = gameData.turnSpinResults[(gameData.turnNumber).toString()];
      if (!isVowel && letter) {
        pts = selectedLetterCounts[letter] * gameData.sectors[sectorIndex].points;
      }
    }

    GuessAPI.checkForOnlyVowelsLeft(updatePacket, correctLetterChars);
    const allCorrectLetters = Object.keys(selectedLetterCounts);
    if (allCorrectLetters.length === updatePacket.correctLetters.length) {
      updatePacket.mode = "end";
      updatePacket.gameFinished = true;
    }

    if (isVowel && currentPts > 150) {
      pts -= 150;
    }
    if (isVowel && currentPts < 150) {
      throw new Error("not enough for vowel");
    }
    updatePacket["seatPoints" + seatIndex] = currentPts + pts;
  }
  /** test to see if only vowels remain (game is completed)
   * @param { any } updatePacket delta to apply to game record
   * @param { Array<string> } correctLetterChars already guessed letters
   */
  static checkForOnlyVowelsLeft(updatePacket: any, correctLetterChars: Array<string>) {
    const vowels = GuessAPI.vowelLetters.split("");
    let onlyVowels = true;
    let vowelsUsed = "";
    for (let c = 0; c < correctLetterChars.length; c++) {
      const letter = correctLetterChars[c];
      if (updatePacket.correctLetters.indexOf(letter) === -1) { // not selected
        if (vowels.indexOf(letter) === -1) {
          onlyVowels = false;
          break;
        } else if (vowelsUsed.indexOf(letter) === -1) {
          vowelsUsed += letter;
        }
      }
    }

    if (onlyVowels) {
      updatePacket.correctLetters += vowelsUsed;
    }
  }
  /** calculates how much to spin the wheel from storage data
   *
   * @param { any } gameData game storage object
   * @return { number } ending position in radians to spin the wheel
   */
  static _calculateWheelAdvance(gameData: any): number {
    const angVelMax = gameData.randomSpin;
    let ang = gameData.wheelPosition;
    let angVel = 0;
    const angVelMin = 0.005; // Below that number will be treated as a stop
    let isAccelerating = true;
    // let friction = gameData.friction;

    while (angVel >= angVelMin || isAccelerating === true) {
      if (angVel >= angVelMax) isAccelerating = false;
      if (isAccelerating) {
        if (!angVel) angVel = angVelMin;
        angVel *= 1.06;
      } else {
        isAccelerating = false;
        angVel *= gameData.friction;

        if (angVel < angVelMin) break;
      }

      ang += angVel; // Update angle
      ang %= 2 * Math.PI; // Normalize angle
    }

    return ang;
  }
  /** process user guess action and return delta packet to apply to storage object
   *
   * @param { any } gameData
   * @param { string } uid
   * @param { any } localInstance
   * @param { string } action
   * @param { string } guessLetter
   * @return { any } updatePacket to apply to storage object
   */
  static async _processGuessAction(gameData: any, uid: string, localInstance: any,
    action: string, guessLetter: string): Promise<any> {
    const updatePacket: any = {};

    if (action === "startGame") {
      if (GameAPI._emptySeat(gameData)) throw new Error("Can't start with empty seats");
      if (gameData.mode === "running") throw new Error("Game already running");
      if (gameData.createUser !== uid) throw new Error("Must be creator to start");

      const beerData = await GuessAPI.getMainData();

      // TODO update seat0 members[uid] = now - so game moves to top - it"s their turn

      const beerSlug = await GameAPI._getRandomBeerSlug();
      const parts = beerSlug.split(":");
      const brewerySlug = parts[0];
      let brewery = {
        name: "",
      };
      if (brewerySlug !== "baseline") {
        brewery = beerData.breweries[brewerySlug];
      }
      const beer = beerData.allBeers[beerSlug];
      updatePacket.solutionText = GuessAPI.gameNameForBeer(brewery, beer);
      updatePacket.solutionText = updatePacket.solutionText.replace(/[^a-z A-Z]+/g, "");
      updatePacket.beerSlug = beerSlug;
      updatePacket.turnPhase = "spin";
      updatePacket.wheelPosition = Math.random() * 2 * Math.PI;
      updatePacket.randomSpin = 0;
      updatePacket.nextWheelPosition = updatePacket.wheelPosition;
      updatePacket.friction = 0.99; // 0.995=soft, 0.99=mid, 0.98=hard
      updatePacket.letters = "";
      updatePacket.correctLetters = "";
      updatePacket.mode = "running";
      updatePacket.seat0Totals = {};
      updatePacket.seat1Totals = {};
      updatePacket.seat2Totals = {};
      updatePacket.seat3Totals = {};
      updatePacket.seatPoints0 = 0;
      updatePacket.seatPoints1 = 0;
      updatePacket.seatPoints2 = 0;
      updatePacket.seatPoints3 = 0;
      updatePacket.turnSpinResults = {};
      updatePacket.turnNumber = 0;
      updatePacket.currentSeat = 0;
      updatePacket.runningNumberOfSeats = gameData.numberOfSeats;
      updatePacket.spinTimeDate = new Date().toISOString();
      updatePacket.sectors = [{
        color: "#f82",
        label: "Next",
        points: -1,
      },
      {
        color: "#0bf",
        label: "100",
        points: 100,
      },
      {
        color: "#fb0",
        label: "200",
        points: 200,
      },
      {
        color: "#0fb",
        label: "300",
        points: 300,
      },
      {
        color: "#f0b",
        label: "400",
        points: 400,
      },
      ];
    }
    if (action === "endGame") {
      if (gameData.createUser !== uid) throw new Error("Must be creator to end");
      updatePacket.mode = "end";
    }
    if (action === "resetGame") {
      if (gameData.createUser !== uid) throw new Error("Must be creator to reset");
      updatePacket.mode = "ready";
    }
    if (action === "playturn") {
      if (gameData.turnPhase !== "letter") throw new Error("Turn phase not in letter");

      let turnNumber = BaseClass.getNumberOrDefault(gameData.turnNumber, 0);
      const currentSeat = turnNumber % gameData.runningNumberOfSeats;
      const seatKey = "seat" + currentSeat.toString();
      const playerUid = gameData[seatKey];
      // let seatIndex = gameData.currentSeat.toString();
      // let currentPts = gameData["seatPoints" + seatIndex];

      if (playerUid === uid) {
        let validLetter = false;

        if (guessLetter >= "a" && guessLetter <= "z") guessLetter = guessLetter.toUpperCase();

        if (!(guessLetter >= "A" && guessLetter <= "Z")) {
          throw new Error("Letter not A to Z");
        } else {
          if (gameData.letters.indexOf(guessLetter) === -1) validLetter = true;
          else throw new Error("Letter already picked");
        }

        if (validLetter) {
          updatePacket.letters = gameData.letters.toString() + guessLetter;
          updatePacket.wheelPosition = gameData.nextWheelPosition;
          GuessAPI._updatePoints(gameData, updatePacket, guessLetter);
          if (updatePacket.correctLetters.indexOf(guessLetter) === -1) {
            turnNumber++;
          }
          updatePacket.turnNumber = turnNumber;
          updatePacket.turnPhase = "spin";
          updatePacket.currentSeat = updatePacket.turnNumber % gameData.runningNumberOfSeats;
          const nextUser = gameData["seat" + updatePacket.currentSeat];
          if (nextUser) {
            if (!updatePacket.members) updatePacket.members = {};
            updatePacket.members[nextUser] = new Date().toISOString();
          }
        }
      } else {
        throw new Error("Not players turn for letter pick");
      }
    }
    if (action === "nextturn") {
      const turnNumber = BaseClass.getNumberOrDefault(gameData.turnNumber, 0);
      const currentSeat = turnNumber % gameData.runningNumberOfSeats;
      const seatKey = "seat" + currentSeat.toString();
      const playerUid = gameData[seatKey];
      if (playerUid !== uid) throw new Error("Must be current player to next turn");

      if (gameData.turnPhase !== "turnover") throw new Error("Turn state not in turn over");
      updatePacket.wheelPosition = gameData.nextWheelPosition;
      updatePacket.turnNumber = turnNumber + 1;
      updatePacket.currentSeat = updatePacket.turnNumber % gameData.runningNumberOfSeats;
      updatePacket.turnPhase = "spin";
      const nextUser = gameData["seat" + updatePacket.currentSeat];
      if (nextUser) {
        if (!updatePacket.members) updatePacket.members = {};
        updatePacket.members[nextUser] = new Date().toISOString();
      }
    }
    if (action === "spin") {
      const turnNumber = BaseClass.getNumberOrDefault(gameData.turnNumber, 0);

      if (gameData.turnPhase !== "spin") throw new Error("Turn state not in spin");

      const seatKey = "seat" + gameData.currentSeat.toString();
      const playerUid = gameData[seatKey];

      if (playerUid === uid) {
        updatePacket.randomSpin = rand(0.08, 0.22);
        gameData.randomSpin = updatePacket.randomSpin;
        updatePacket.spinTimeDate = new Date().toISOString();
        updatePacket.nextWheelPosition = GuessAPI._calculateWheelAdvance(gameData);
        const sectorCount = gameData.sectors.length;
        const turnSector = Math.floor(sectorCount - updatePacket.nextWheelPosition / (2 * Math.PI) * sectorCount) % sectorCount;
        updatePacket.turnPhase = "letter";
        updatePacket.turnSpinResults = {
          [gameData.turnNumber]: turnSector,
        };
        if (gameData.sectors[turnSector].points === -1) {
          updatePacket.turnPhase = "turnover";
        }
        updatePacket.turnNumber = turnNumber;
      } else {
        throw new Error("Not players turn for spin");
      }
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
    const guessLetter = req.body.guessLetter;

    try {
      const gQuery = firebaseAdmin.firestore().doc(`Games/${gameId}`);
      await firebaseAdmin.firestore().runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(gQuery);
        if (!sfDoc.exists) {
          throw new Error("Game does not exist");
        }
        const gameData = sfDoc.data();

        const updatePacket = await GuessAPI._processGuessAction(gameData, uid, localInstance, action, guessLetter);

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

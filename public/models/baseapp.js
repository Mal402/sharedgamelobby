import Utility from "./utility.js";
/** Base class for all pages - handles authorization and low level routing for api calls, etc */
class BaseApp {
    /** constructor  */
    constructor() {
        this.baseRedrawFeedTimer = 90000;
        this.feedLimit = 10;
        this.deferredPWAInstallPrompt = null;
        this.projectId = firebase.app().options.projectId;
        this.basePath = `https://us-central1-${this.projectId}.cloudfunctions.net/`;
        this.urlParams = new URLSearchParams(window.location.search);
        this.startBeer = "";
        this.startTag = "";
        this.filterTagsList = [];
        this.muted = false;
        this.night_mode_toggle = null;
        this.tagList = [];
        this.allBeers = null;
        this.uid = null;
        this.profile = null;
        this.fireUser = null;
        this.fireToken = null;
        this.profileSubscription = null;
        this.profileInited = false;
        this.nightModeCurrent = false;
        this.mute_button = null;
        this.soundGameStateCache = {};
        this.audios = new Map();
        this.pickAudio = null;
        this.downAudio = null;
        this.upAudio = null;
        this.lockAudio = null;
        this.login_email = null;
        this.tagColorsArrays = [];
        this.tagPens = [];
        this.tagColors = [];
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            this.deferredPWAInstallPrompt = e;
        });
        if (window.location.hostname === "localhost")
            this.basePath = `http://localhost:5001/${this.projectId}/us-central1/`;
        this.startBeer = this.urlParams.get("beer");
        this.startTag = this.urlParams.get("tag");
        this.night_mode_toggle = document.querySelector(".night_mode_toggle");
        if (this.night_mode_toggle)
            this.night_mode_toggle.addEventListener("click", (e) => this.nightModeToggle(e));
        firebase.auth().onAuthStateChanged((u) => this.authHandleEvent(u));
        this.signInWithURL();
        this.load();
    }
    /** asynchronous loads - data setup  */
    async load() {
        const promises = [];
        promises.push(this.readJSONFile(`/data/breweryMap.json`, "breweryJSON"));
        promises.push(this.readJSONFile(`/data/beerMap.json`, "allBeers"));
        promises.push(this.readJSONFile(`/data/beerTags.json`, "beerTagsMap"));
        promises.push(this.readJSONFile(`/data/beerTotals.json`, "beerTotals"));
        await Promise.all(promises);
        this.tagList = Object.keys(window.beerTagsMap);
        this.tagList = this.tagList.sort();
        this._generateColors();
        this.allBeers = window.allBeers;
        this.authUpdateStatusUI();
    }
    /** reads a json file async and sets window.varName to it's value
     * @param { string } path url to json data
     * @param { string } varName window.variable to hold data
     */
    async readJSONFile(path, varName) {
        if (window[varName])
            return;
        try {
            const response = await fetch(path);
            window[varName] = await response.json();
        }
        catch (e) {
            console.log("ERROR with download of " + varName, e);
            window[varName] = {};
        }
    }
    /** Paints UI display/status for user profile based changes */
    authUpdateStatusUI() {
        document.body.classList.add("loaded");
        if (this.fireToken) {
            if (document.body.dataset.creator === this.uid)
                document.body.classList.add("user_editable_record");
        }
        if (this.profile) {
            this.updateNightModeStatus(this.profile.nightModeState);
            this.updateUserStatus();
            this.updateMute(this.profile.muteState);
        }
    }
    /** firebase authorization event handler
     * @param { any } user logged in user - or null if not logged in
     */
    async authHandleEvent(user) {
        // ignore unwanted events
        if (user && this.uid === user.uid) {
            return;
        }
        if (user) {
            this.fireUser = user;
            this.uid = this.fireUser.uid;
            this.fireToken = await user.getIdToken();
            document.body.classList.add("app_signed_in");
            document.body.classList.remove("app_signed_out");
            if (this.fireUser.isAnonymous)
                document.body.classList.add("signed_in_anonymous");
            await this._authInitProfile();
        }
        else {
            this.fireToken = null;
            this.fireUser = null;
            this.uid = null;
            document.body.classList.remove("app_signed_in");
            document.body.classList.add("app_signed_out");
            this.authUpdateStatusUI();
        }
        return;
    }
    /** setup watch for user profile changes */
    async _authInitProfile() {
        this.profileSubscription = firebase.firestore().doc(`Users/${this.uid}`)
            .onSnapshot(async (snapshot) => {
            this.profileInited = true;
            this.profile = snapshot.data();
            if (!this.profile) {
                if (this.fireUser.email) {
                    const result = await firebase.auth().fetchSignInMethodsForEmail(this.fireUser.email);
                    // user was deleted dont create new profile - this is the case where the user deletes the account in browser
                    if (result.length < 1)
                        return;
                }
                await this._authCreateDefaultProfile();
            }
            this.authUpdateStatusUI();
        });
    }
    /** create default user profile record and overwrite to database without merge (reset) */
    async _authCreateDefaultProfile() {
        await this.readJSONFile(`/profile/logos.json`, "profileLogos");
        const keys = Object.keys(window.profileLogos);
        const imageIndex = Math.floor(Math.random() * keys.length);
        const logoName = keys[imageIndex];
        this.profile = {
            displayName: Utility.generateName(),
            displayImage: window.profileLogos[logoName],
        };
        await firebase.firestore().doc(`Users/${this.uid}`).set(this.profile);
    }
    /** update user auth status, username/email etc */
    updateUserStatus() {
        return;
    }
    /** store user profile for nightmode
     * @param { any } ctl dom object
     * @param { number } index 0 = auto, 1 for day, 2 for nite
     * @param { any } e dom event object - preventDefault is called to stop anchor from navigating
     */
    async updateProfileNightMode(ctl, index, e) {
        const updatePacket = {
            nightModeState: index,
        };
        this.updateNightModeStatus(index);
        if (this.fireToken)
            await firebase.firestore().doc(`Users/${this.uid}`).update(updatePacket);
        if (e)
            e.preventDefault();
    }
    /** paint night mode status change
     * @param { number } state 0 = auto, 1 for day, 2 for nite
     */
    updateNightModeStatus(state = 0) {
        let nite = false;
        if (state === 2)
            nite = true;
        if (state === 0) {
            if (new Date().getHours() < 8 || new Date().getHours() > 18)
                nite = true;
        }
        this.nightModeCurrent = nite;
        if (nite)
            document.body.classList.add("night_mode");
        else
            document.body.classList.remove("night_mode");
    }
    /** button handler for toggle night mode
     * @param { any } e dom event object
     * @return { boolean } true to stop anchor navigation
     */
    nightModeToggle(e) {
        let niteMode = 2;
        if (this.nightModeCurrent)
            niteMode = 1;
        this.updateNightModeStatus(niteMode);
        this.updateProfileNightMode(null, niteMode, null);
        e.preventDefault();
        return true;
    }
    /** store mute setting for user, mute any active sounds
     * @param { boolean } muted true if muted
     */
    async updateMute(muted) {
        this.muted = muted;
        if (!this.mute_button)
            return;
        if (muted) {
            this.mute_button.children[0].innerHTML = "volume_off";
            if (this.pickAudio)
                this.pickAudio.pause();
            if (this.downAudio)
                this.downAudio.pause();
            if (this.upAudio)
                this.upAudio.pause();
            if (this.lockAudio)
                this.lockAudio.pause();
            this.audios.forEach((audio) => audio.pause());
            muted = true;
        }
        else {
            this.mute_button.children[0].innerHTML = "volume_up";
            muted = false;
        }
        if (this.profile) {
            await firebase.firestore().doc(`Users/${this.uid}`).update({
                muteState: muted,
            });
        }
    }
    /** google sign in handler
     * @param { any } e dom event - preventDefault is called if passed
     */
    async authGoogleSignIn(e) {
        e.preventDefault();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            "prompt": "select_account",
        });
        await firebase.auth().signInWithPopup(provider);
    }
    /** anonymous sign in handler
     * @param { any } e dom event - preventDefault is called if passed
     */
    async signInAnon(e) {
        e.preventDefault();
        await firebase.auth().signInAnonymously();
        setTimeout(() => {
            location.href = "/";
        }, 1);
        return true;
    }
    /** email sign in handler from UI (sends email to user for logging in)
     * @param { any } e dom event - preventDefault is called if passed
     */
    async signInByEmail(e) {
        e.preventDefault();
        let email = "";
        if (this.login_email)
            email = this.login_email.value;
        /*
        if (!email) {
          email = window.prompt("Please provide your email to send link");
        }*/
        if (!email) {
            alert("A valid email is required for sending a link");
            return;
        }
        const actionCodeSettings = {
            url: window.location.href,
            handleCodeInApp: true,
        };
        await firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
        window.localStorage.setItem("emailForSignIn", email);
        alert("Email Sent");
    }
    /** for use on page load - tests if a signIn token was included in the URL */
    signInWithURL() {
        if (!firebase.auth().isSignInWithEmailLink)
            return;
        if (firebase.auth().isSignInWithEmailLink(window.location.href) !== true)
            return;
        let email = window.localStorage.getItem("emailForSignIn");
        if (!email)
            email = window.prompt("Please provide your email for confirmation");
        firebase.auth().signInWithEmailLink(email, window.location.href)
            .then(() => {
            window.localStorage.removeItem("emailForSignIn");
            window.location = "/profile";
        })
            .catch((e) => console.log(e));
    }
    /** setup colors for tags */
    _generateColors() {
        this.tagList = Object.keys(window.beerTagsMap);
        this.tagList = this.tagList.sort();
        this.tagColorsArrays = [];
        this.tagList.forEach((tag) => {
            let color = [250, 190, 50];
            if (window.beerTagsMap[tag] === "bitter")
                color = [40, 240, 40];
            if (window.beerTagsMap[tag] === "distinct")
                color = [255, 0, 255];
            this.tagColorsArrays.push(color);
        });
        // r, g, b
        this.tagPens = [];
        this.tagColors = [];
        for (let c = 0; c < this.tagColorsArrays.length; c++) {
            const r = this.tagColorsArrays[c][0];
            const g = this.tagColorsArrays[c][1];
            const b = this.tagColorsArrays[c][2];
            this.tagColors.push(`rgb(${r}, ${g}, ${b})`);
            const fc = (r / 255 + (g / 255 * 1.5) + b / 255 > 1.4) ? "black" : "white";
            this.tagPens.push(fc);
        }
    }
    /** returns the extended name for a beer from the slug
     * @param { string } beer beerSlug
     * @param { number } option 0: (default) brewey beer 2: beer, brewery
     * @return { string } beer description
     */
    gameNameForBeer(beer, option = 0) {
        const beerData = this.allBeers[beer];
        if (!beerData)
            return "missing name";
        const name = beerData.name ? beerData.name : "Missing Name";
        const slugs = beer.split(":");
        const brewerySlug = slugs[0];
        const brewery = window.breweryJSON[brewerySlug];
        let bName = brewery.name;
        if (beerData.breweryName)
            bName = beerData.breweryName;
        return (option === 1) ? name + ", " + bName : bName + " " + name;
    }
    /** shuffles array order in place
     * @param { Array<any> } array array of any type
     * @return { Array<any> } passed in array returned in randomized order
     */
    _shuffleArray(array) {
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
    /** init sounds ready to play */
    loadAudios() {
        return;
    }
    /** returns text value for time since Now, i.e. 3 mins ago
     * @param { Date } date value to format
     * @return { string } formatted string value for time since
     */
    timeSince(date) {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1)
            return Math.floor(interval) + ` year${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 2592000;
        if (interval > 1)
            return Math.floor(interval) + ` month${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 86400;
        if (interval > 1)
            return Math.floor(interval) + ` day${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 3600;
        if (interval > 1)
            return Math.floor(interval) + ` hour${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 60;
        if (interval > 1)
            return Math.floor(interval) + ` min${Math.floor(interval) === 1 ? "" : "s"} ago`;
        //  return Math.floor(seconds) + " seconds ago";
        return " just now";
    }
    /** convert isodate to local date as Date Object
     * @param { string } startTimeISOString iso date GMT referenced
     * @return { Date } JS Date object with date in local time zone reference
     */
    isoToLocal(startTimeISOString) {
        const startTime = new Date(startTimeISOString);
        const offset = startTime.getTimezoneOffset();
        return new Date(startTime.getTime() - (offset * 60000));
    }
    /** return mm/dd/yy for Date or String passed in
     * @param { any } d Date(d) is parsed
     * @return { string } mm/dd/yy string value
     */
    shortShowDate(d) {
        d = new Date(d);
        if (isNaN(d))
            return "";
        const str = d.toISOString().substr(0, 10);
        const mo = str.substr(5, 2);
        const ye = str.substr(2, 2);
        const da = str.substr(8, 2);
        return `${mo}/${da}/${ye}`;
    }
    /** mute click handler
     * @param { any } e dom event (preventDefault called if passed)
     * @return { boolean } true to cancel anchor navigation
     */
    muteClick(e) {
        this.muted = (!this.muted);
        this.updateMute(this.muted);
        e.preventDefault();
        return true;
    }
    /** calulate beer tag UI meta info
     * @param { string } beer beer slug (brewery:beer)
     * @return { any }
     */
    calcBeerTags(beer) {
        const data = window.beerTotals.beers[beer];
        if (!data) {
            return {};
        }
        const tags = data.sortedTags;
        let tagthreshold = data[tags[0]];
        for (let c = 1; c < 4; c++) {
            if (data[tags[c]] > tagthreshold)
                tagthreshold = data[tags[c]];
        }
        const levels = [];
        const backgroundColors = [];
        const colors = [];
        const returnTags = [];
        for (let c = 0; c < 4; c++) {
            levels.push(data[tags[c]] / tagthreshold);
            const index = this.tagList.indexOf(tags[c]);
            backgroundColors.push(this.tagColors[index]);
            colors.push(this.tagPens[index]);
            returnTags.push(tags[c]);
        }
        return {
            threshold: tagthreshold,
            levels,
            backgroundColors,
            colors,
            tags: returnTags,
        };
    }
    /** play audio with try catch to wrap no user interaction error
     * @param { any } audio plays audio file
     */
    playAudio(audio) {
        audio.play().then(null, (e) => console.log("audio play error", e));
    }
    /** add audio file
     * @param { string } name name to map
     * @param { string } path url to audio
    */
    addAudio(name, path) {
        const audio = new Audio(path);
        this.audios.set(name, audio);
        audio.load();
    }
}
export default BaseApp;
//# sourceMappingURL=baseapp.js.map
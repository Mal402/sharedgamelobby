import BaseApp from "./baseapp.js";
import Utility from "./utility.js";
declare const window: any;
declare const firebase: any;

/** app class for profile page */
export class ProfileApp extends BaseApp {
  logged_in_status: any = document.querySelector(".logged_in_status");
  login_google: any = document.getElementById("login_google");
  login_email_anchor: any = document.getElementById("login_email_anchor");
  anon_login_anchor: any = document.querySelector(".anon_login_anchor");
  sign_out_button: any = document.querySelector(".sign_out_button");
  night_mode_radios: any = document.querySelectorAll("[name=\"night_mode_radio\"]");
  mute_audio_radios: any = document.querySelectorAll("[name=\"mute_audio_radio\"]");
  reset_profile: any = document.querySelector(".reset_profile");
  profile_display_name: any = document.querySelector(".profile_display_name");
  profile_display_image: any = document.querySelector(".profile_display_image");
  chatgpt_key: any = document.querySelector(".chatgpt_key");
  profile_display_image_upload: any = document.querySelector(".profile_display_image_upload");
  file_upload_input: any = document.querySelector(".file_upload_input");
  profile_display_image_clear: any = document.querySelector(".profile_display_image_clear");
  profile_display_image_preset: any = document.querySelector(".profile_display_image_preset");
  randomize_name: any = document.querySelector(".randomize_name");
  login_email: any = document.querySelector(".login_email");
  lastNameChange = 0;

  /** */
  constructor() {
    super();

    this.login_google.addEventListener("click", (e: any) => this.authGoogleSignIn(e));
    this.login_email_anchor.addEventListener("click", (e: any) => this.signInByEmail(e));
    this.anon_login_anchor.addEventListener("click", (e: any) => this.signInAnon(e));

    this.sign_out_button.addEventListener("click", (e: any) => {
      this.authSignout(e);
      e.preventDefault();
      return false;
    });
    this.night_mode_radios.forEach((ctl: any, index: number) => ctl.addEventListener("input", (e: any) => {
      this.updateProfileNightMode(ctl, index, e);
    }));
    this.mute_audio_radios.forEach((ctl: any, index: number) => ctl.addEventListener("input", () => this.updateProfileAudioMode(index)));
    this.reset_profile.addEventListener("click", (e: any) => {
      if (confirm("Are you sure you want to clear out all reviews and profile data?")) {
        this._authCreateDefaultProfile();
      }
      e.preventDefault();
      return true;
    });

    this.profile_display_name.addEventListener("input", () => this.displayNameChange());
   
    this.chatgpt_key.addEventListener("input", () => this.chatGPTChange());
     this.profile_display_image_upload.addEventListener("click", () => this.uploadProfileImage());
    this.file_upload_input.addEventListener("input", () => this.fileUploadSelected());
    this.profile_display_image_clear.addEventListener("click", () => this.clearProfileImage());
    this.profile_display_image_preset.addEventListener("input", () => this.handleImagePresetChange());
    this.randomize_name.addEventListener("click", () => this.randomizeProfileName());

    this.initPresetLogos();
  }
  /** load the team logos <select> */
  async initPresetLogos() {
    await this.readJSONFile(`/profile/logos.json`, "profileLogos");
    let html = "<option>Select a preset image</option>";

    for (const logo in window.profileLogos) {
      if (window.profileLogos[logo]) html += `<option value="${window.profileLogos[logo]}">${logo}</option>`;
    }

    this.profile_display_image_preset.innerHTML = html;
  }
  /** team image <select> change handler */
  async handleImagePresetChange() {
    if (this.profile_display_image_preset.selectedIndex > 0) {
      const updatePacket = {
        rawImage: this.profile_display_image_preset.value,
        displayImage: this.profile_display_image_preset.value,
      };
      if (this.fireToken) {
        await firebase.firestore().doc(`Users/${this.uid}`).set(updatePacket, {
          merge: true,
        });
      }
    }
  }
  /** signout of firebase authorization
   * @param { any } e dom event
   */
  async authSignout(e: any) {
    e.preventDefault();
    if (this.fireToken) {
      await firebase.auth().signOut();

      this.fireToken = null;
      this.fireUser = null;
      this.uid = null;

      window.location = "/profile";
    }
  }
  /** BaseApp override to paint profile specific authorization parameters */
  authUpdateStatusUI() {
    if (this.profile) {
      let displayName = this.profile.displayName;
      if (!displayName) displayName = "";

      if (!this.lastNameChange || this.lastNameChange + 2000 < new Date().getTime()) this.profile_display_name.value = displayName;


      let chatGptKey = this.profile.chatGptKey;
      if (!chatGptKey)
          chatGptKey = "";
      if (!this.lastNameChange || this.lastNameChange + 2000 < new Date().getTime())
          this.chatgpt_key.value = chatGptKey;



      if (this.profile.displayImage) this.profile_display_image.style.backgroundImage = `url(${this.profile.displayImage})`;
      else this.profile_display_image.style.backgroundImage = `url(/images/defaultprofile.png)`;

      if (this.profile.displayImage) this.profile_display_image_preset.value = this.profile.displayImage;
      else this.profile_display_image_preset.selectedIndex = 0;
    }

    super.authUpdateStatusUI();
    this.updateInfoProfile();
  }
  /** handle (store) change to users display name */
  async displayNameChange() {
    this.profile.displayName = this.profile_display_name.value.trim().substring(0, 15);

    const updatePacket = {
      displayName: this.profile.displayName,
    };
    if (this.fireToken) {
      await firebase.firestore().doc(`Users/${this.uid}`).set(updatePacket, {
        merge: true,
      });
    }
    this.lastNameChange = new Date().getTime();
  }
  /** paint user profile */
  updateInfoProfile() {
    if (!this.profile || !this.tagList) {
      return;
    }
    let email = firebase.auth().currentUser.email;
    if (!email) email = "Logged in as: Anonymous";

    this.logged_in_status.innerHTML = email;

    if (!this.profile.nightModeState) this.profile.nightModeState = 0;
    if (this.night_mode_radios.length > 0) {
      this.night_mode_radios[this.profile.nightModeState].checked = true;
    }

    if (!this.profile.muteState) {
      this.muted = false;
      this.profile.muteState = false;
    } else {
      this.muted = true;
      this.profile.muteState = true;
    }
    if (this.mute_audio_radios.length > 0) {
      if (this.muted) this.mute_audio_radios[0].checked = true;
      else this.mute_audio_radios[1].checked = true;
    }
  }
      /** handle (store) change to users display name */
      async chatGPTChange() {
        this.profile.chatGptKey = this.chatgpt_key.value.trim();
        const updatePacket = {
            chatGptKey: this.profile.chatGptKey,
        };
        if (this.fireToken) {
            await firebase.firestore().doc(`Users/${this.uid}`).set(updatePacket, {
                merge: true,
            });
        }
        this.lastNameChange = new Date().getTime();
    }
  /** open file picker for custom profile image upload */
  uploadProfileImage() {
    this.file_upload_input.click();
  }
  /** handle local profile image selected for upload and store it */
  async fileUploadSelected() {
    const file = this.file_upload_input.files[0];
    const sRef = firebase.storage().ref("Users").child(this.uid + "/pimage");

    if (file.size > 2500000) {
      alert("File needs to be less than 1mb in size");
      return;
    }

    this.profile_display_image.style.backgroundImage = ``;

    await sRef.put(file);
    const path = await sRef.getDownloadURL();
    setTimeout(() => this._finishImagePathUpdate(path), 1500);
  }
  /** handle profile image upload complete
   * @param { string } path cloud path to image (includes uid)
   */
  async _finishImagePathUpdate(path: string) {
    const sRef2 = firebase.storage().ref("Users").child(this.uid + "/_resized/pimage_200x200");
    const resizePath = await sRef2.getDownloadURL();
    const updatePacket = {
      rawImage: path,
      displayImage: resizePath,
    };
    if (this.fireToken) {
      await firebase.firestore().doc(`Users/${this.uid}`).set(updatePacket, {
        merge: true,
      });
    }
  }
  /** reset profile image (and store result in user profile) */
  async clearProfileImage() {
    const updatePacket = {
      displayImage: "",
    };
    if (this.fireToken) {
      await firebase.firestore().doc(`Users/${this.uid}`).set(updatePacket, {
        merge: true,
      });
    }
  }
  /** handle for mute/audio settings change
   * @param { number } index radio button index (to set value)
  */
  async updateProfileAudioMode(index: number) {
    const updatePacket = {
      muteState: (index === 0),
    };
    if (this.fireToken) await firebase.firestore().doc(`Users/${this.uid}`).update(updatePacket);
  }
  /** generate a random "safe" name */
  async randomizeProfileName(): Promise<void> {
    const updates = {
      displayName: Utility.generateName(),
    };

    await firebase.firestore().doc(`Users/${this.uid}`).set(updates, {
      merge: true,
    });
  }
}

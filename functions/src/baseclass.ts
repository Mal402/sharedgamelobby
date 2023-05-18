import * as firebaseAdmin from "firebase-admin";

/**
 * Instanced class for micro services (hold state during processing here)
 */
class LocalInstance {
  public db: any = {};
  public privateConfig: any = {};
  public publicConfig: any = {};

  /** initialize configuration data */
  async init() {
    this.db = firebaseAdmin.firestore();

    const configQuery = await this.db.doc("/configuration/private").get();
    const publicQuery = await this.db.doc("/configuration/public").get();
    if (configQuery.exists) this.privateConfig = configQuery.data();
    if (publicQuery.exists) this.publicConfig = publicQuery.data();

    return;
  }
  /** validation admin (override) token
   *  @param { string } token from http header
   *  @return { boolean } valid
   */
  validateAdminToken(token: string): boolean {
    const adminToken = this.privateConfig.adminToken;
    if (!token) return false;
    return (adminToken === token);
  }
}

/** static functions to support micro services */
export default class BaseClass {
  /** gets local instance with public and private config
   * @return { any } object with data
   */
  static newLocalInstance(): any {
    return new LocalInstance();
  }
  /** tests numeric
   * @param { string } v incoming value
   * @return { boolean } valid number
   */
  static isNumeric(v: any): boolean {
    if (v === undefined) return false;
    if (v === "") return false;
    return !isNaN(Number(v)) && isFinite(Number(v));
  }
  /** Number helper
   * @param { string } str incoming value
   * @param { number } d default number value
   * @return { number } valid number or default value
  */
  static getNumberOrDefault(str: string, d: number): number {
    if (this.isNumeric(str)) return Number(str);
    return d;
  }
  /** safe deep path value lookup
   * @param { any } obj object to inspect
   * @param { string } is deep path to value i.e. "a.b.c" for obj.a.b.c
   * @param { any } value value to set (leave undefined to not set)
   * @return { any } value looked up
  */
  static path(obj: any, is: any, value: any): any {
    try {
      if (!obj) return "";
      if (typeof is === "string") return this.path(obj, is.split("."), value);
      else if (is.length === 1 && value !== undefined) return obj[is[0]] = value;
      else if (is.length === 0) return obj;
      else if (!obj[is[0]]) return "";
      else return this.path(obj[is[0]], is.slice(1), value);
    } catch (e) {
      console.log("path() err", e);
      return "";
    }
  }
  /** looks up uid for an email
   * @param { string } email incoming email
   * @return { any } obj with uid result, success: true if lookup hit
  */
  static async uidForEmail(email: string): Promise<any> {
    try {
      const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
      return {
        uid: userRecord.uid,
        success: true,
      };
    } catch (error) {
      return {
        sucess: false,
        error,
        errorMessage: "uid not found for email " + email,
      };
    }
  }
  /** validates passed in token returns email and uid
   * @param { string } firebaseusertoken incoming token
   * @return { any } uid and email in object
  */
  static async validateCredentials(firebaseusertoken: string): Promise<any> {
    try {
      let decodedToken = null;
      decodedToken = await firebaseAdmin.auth().verifyIdToken(firebaseusertoken);

      const email = decodedToken.email;
      const uid = decodedToken.uid;

      return {
        success: true,
        email,
        uid,
      };
    } catch (errObject) {
      return {
        errorMessage: "Failed to verify firebase user token",
        errObject,
        success: false,
      };
    }
  }
  /** standardized error response for rest api
   * @param { any } res incoming node response object
   * @param { string } errorMessage error description
   * @param { any } errorObject optional json object
   * @return { Promise } res.send - includes err.stack
  */
  static async respondError(res: any, errorMessage: string, errorObject: any = null): Promise<any> {
    const err = new Error();
    // log errors here if wanted later
    return res.status(200).send({
      success: false,
      errorMessage,
      errorObject,
      stack: err.stack,
    });
  }
  /** gets local adjusted data from isodate
   * @param { string } startTimeISOString GMT iso datetime string
   * @return { Date } Date() object offset to local time
  */
  static isoToLocal(startTimeISOString: string): Date {
    const startTime = new Date(startTimeISOString);
    let offset = startTime.getTimezoneOffset();
    if (!offset) offset = 300;
    return new Date(startTime.getTime() - (offset * 60000));
  }
  /** escape html
   * @param { string } str  raw string to escape
   * @return { string } escaped string
  */
  static escapeHTML(str: string): string {
    return str.replace(/[&<>'"]/g,
      (match) => {
        switch (match) {
          case "&": return "&amp;";
          case "<": return "&lt;";
          case ">": return "&gt;";
          case "'": return "&#39;";
          case "\"": return "&quot;";
        }

        return match;
      });
  }
}

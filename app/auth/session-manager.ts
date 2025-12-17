
class SessionManager {
  readonly KEY_SID: string = 'sid';

  set(sid: string) {
    localStorage.setItem(this.KEY_SID, sid);
  }

  get(): string | undefined {
    return localStorage.getItem(this.KEY_SID) ?? undefined;
  }

  has(): boolean {
    return !!this.get();
  }

  clear() {
    localStorage.removeItem(this.KEY_SID);
  }
}

const sessionManager = new SessionManager();

export { sessionManager };

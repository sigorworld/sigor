import { fetchProfiles } from "../api/profile";
import type { EvmAddress } from "../types/world";

function shorten(addr: string) {
  if (!addr?.startsWith("0x") || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export class ProfileStore extends EventTarget {
  private nick = new Map<EvmAddress, string | null>(); // null = 로드됐지만 닉네임 없음
  private loading = new Set<EvmAddress>();

  getNickname(addr: EvmAddress): string | null | undefined {
    return this.nick.get(addr);
  }

  getDisplayName(addr: EvmAddress): string {
    const n = this.nick.get(addr);
    return n ? n : shorten(addr);
  }

  async ensure(addresses: EvmAddress[]) {
    const missing = addresses.filter((a) => !this.nick.has(a) && !this.loading.has(a));
    if (missing.length === 0) return;

    for (const a of missing) this.loading.add(a);

    try {
      const res = await fetchProfiles(missing as any);
      for (const a of missing) {
        const p = res[a as any] ?? null;
        const nick = p?.nickname?.trim() ? p.nickname.trim() : null;
        this.nick.set(a, nick);
        this.loading.delete(a);
      }

      this.dispatchEvent(new CustomEvent("update", { detail: { addresses: missing } }));
    } catch (e) {
      // 실패해도 다음에 다시 시도할 수 있게 loading만 해제
      for (const a of missing) this.loading.delete(a);
      throw e;
    }
  }
}

export const globalProfileStore = new ProfileStore();

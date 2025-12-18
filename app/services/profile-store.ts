import { fetchNftRowByContractToken, NftRow } from "../api/nfts";
import { fetchProfiles, type Profile } from "../api/profile";
import type { EvmAddress } from "../types/world";

type Appearance = {
  nftAddress: string;
  tokenId: number;
  parts?: any;
  image?: string;
};

function shorten(addr: string) {
  if (!addr?.startsWith("0x") || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function primaryKey(p: Profile | null): string | null {
  const ca = p?.primary_nft_contract_address;
  const tid = p?.primary_nft_token_id;
  if (!ca || !tid) return null;
  const n = Number(tid);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${ca}:${n}`;
}

function toAppearance(nft: NftRow | null): Appearance | null {
  if (!nft) return null;
  return {
    nftAddress: nft.contract_addr,
    tokenId: nft.id,
    parts: nft.parts,
    image: nft.image,
  };
}

export class ProfileStore extends EventTarget {
  private nick = new Map<EvmAddress, string | null>(); // null=로드됐지만 닉네임 없음
  private appearance = new Map<EvmAddress, Appearance | null>(); // null=로드됐지만 외형 없음/불러오기 실패
  private lastPrimary = new Map<EvmAddress, string | null>(); // primary key 변경 감지용
  private loading = new Set<EvmAddress>();

  // NFT 상세 캐시: 같은 primary NFT면 여러 유저가 공유 가능
  private nftCache = new Map<string, Appearance | null>();
  private nftInflight = new Map<string, Promise<Appearance | null>>();

  getNickname(addr: EvmAddress): string | null | undefined {
    return this.nick.get(addr);
  }

  getDisplayName(addr: EvmAddress): string {
    const n = this.nick.get(addr);
    return n ? n : shorten(addr);
  }

  getAppearance(addr: EvmAddress): Appearance | null | undefined {
    return this.appearance.get(addr);
  }

  private async getNftAppearanceByKey(key: string, force = false): Promise<Appearance | null> {
    if (force) {
      this.nftCache.delete(key);
      this.nftInflight.delete(key);
    }

    if (this.nftCache.has(key)) return this.nftCache.get(key)!;

    const inflight = this.nftInflight.get(key);
    if (inflight) return inflight;

    const [contract, tokenIdStr] = key.split(":");
    const tokenId = Number(tokenIdStr);

    const p = (async () => {
      try {
        const nft = await fetchNftRowByContractToken({
          nft_address: contract as `0x${string}`,
          token_id: tokenId,
        });
        const app = toAppearance(nft);
        this.nftCache.set(key, app);
        return app;
      } catch {
        // 실패도 캐시해둬서 무한 재시도 방지
        this.nftCache.set(key, null);
        return null;
      } finally {
        this.nftInflight.delete(key);
      }
    })();

    this.nftInflight.set(key, p);
    return p;
  }

  /**
   * ✅ ensure: 프로필/외형을 보장
   * - 기본: "처음 보는 주소"만 로드(기존 동작)
   * - force=true: 이미 로드된 주소도 다시 로드 → 메인 NFT 변경 즉시 반영에 필요
   */
  async ensure(addresses: EvmAddress[], opts?: { force?: boolean }) {
    const force = !!opts?.force;

    const targets = addresses.filter((a) => {
      if (this.loading.has(a)) return false;
      if (force) return true;
      return !this.nick.has(a);
    });

    if (targets.length === 0) return;

    for (const a of targets) this.loading.add(a);

    try {
      const profiles = await fetchProfiles(targets as any);

      // 1) 닉네임/primaryKey 저장
      const primaryKeysToFetch = new Set<string>();

      for (const a of targets) {
        const p = profiles[a as any] ?? null;

        const nick = p?.nickname?.trim() ? p.nickname.trim() : null;
        this.nick.set(a, nick);

        const pk = primaryKey(p);
        const last = this.lastPrimary.get(a) ?? undefined;

        // ✅ force면 무조건 갱신 대상으로
        if (force || pk !== (last ?? null) || !this.appearance.has(a)) {
          this.lastPrimary.set(a, pk);
          if (pk) primaryKeysToFetch.add(pk);
        }
      }

      // 2) primary NFT appearance 병렬 로드
      const keyToAppearance = new Map<string, Appearance | null>();
      await Promise.all(
        Array.from(primaryKeysToFetch).map(async (k) => {
          const app = await this.getNftAppearanceByKey(k, force);
          keyToAppearance.set(k, app);
        })
      );

      // 3) address별 appearance 적용
      for (const a of targets) {
        const pk = this.lastPrimary.get(a) ?? null;
        if (!pk) {
          this.appearance.set(a, null);
          continue;
        }
        const app = keyToAppearance.get(pk) ?? this.nftCache.get(pk) ?? null;
        this.appearance.set(a, app);
      }

      for (const a of targets) this.loading.delete(a);

      this.dispatchEvent(new CustomEvent("update", { detail: { addresses: targets } }));
    } catch (e) {
      for (const a of targets) this.loading.delete(a);
      throw e;
    }
  }
}

export const globalProfileStore = new ProfileStore();

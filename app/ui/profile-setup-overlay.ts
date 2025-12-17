import { tokenManager } from "@gaiaprotocol/client-common";
import { el } from "@webtaku/el";
import { getAddress } from "viem";

import { fetchHeldNfts, HeldNft } from "../api/nfts";
import { fetchProfile, setProfile } from "../api/profile";
import { showErrorAlert } from "../components/alert";

import "./auth-overlays.css"; // 기존 카드 스타일 재사용
import "./profile-setup-overlay.css"; // NFT 그리드/필드 스타일

let currentProfileOverlay: HTMLElement | null = null;

function removeProfileOverlay() {
  currentProfileOverlay?.remove();
  currentProfileOverlay = null;
}

// 상대/절대 경로 이미지 보정(기존 코드 재사용)
function toImageUrl(img?: string | null) {
  if (!img) return "";
  try {
    return new URL(img).href;
  } catch {
    return `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/${img}`;
  }
}

function isProfileIncomplete(p: any): boolean {
  // “프로필 정보가 없거나 primary_nft 설정이 되어있지 않다면”
  // → 여기서는 primary_nft가 없으면 무조건 incomplete로 처리 (요구사항 핵심)
  const hasPrimary = !!(p?.primary_nft_contract_address && p?.primary_nft_token_id);
  return !hasPrimary;
}

async function withLoading<T>(cardEl: HTMLElement, fn: () => Promise<T>, msg = "처리 중..."): Promise<T> {
  // auth-overlays.ts에서 쓰던 로딩 패턴을 간단히 재현
  const loading = el("div", { style: "font-size:12px;color:#6b7280;font-weight:800;margin-top:6px;" }, msg);
  cardEl.appendChild(loading);
  try {
    return await fn();
  } finally {
    loading.remove();
  }
}

export async function refreshProfileSetupOverlay() {
  // 0) 토큰 없으면 오버레이 고려 대상 아님
  const token = tokenManager.getToken();
  const addrRaw = tokenManager.getAddress();
  if (!token || !addrRaw) {
    removeProfileOverlay();
    return;
  }

  const myAddress = getAddress(addrRaw);

  // 1) 프로필 로드
  let profile: any = null;
  try {
    profile = await fetchProfile(myAddress);
  } catch (e) {
    // 프로필 조회 실패는 “일단 오버레이 띄우고 저장으로 복구” 전략이 UX상 나음
    profile = null;
  }

  // 2) 조건 불만족이면 띄우기
  if (!isProfileIncomplete(profile)) {
    removeProfileOverlay();
    return;
  }

  // 이미 떠 있으면 재마운트하지 않음
  if (currentProfileOverlay) return;

  // 3) 오버레이 생성
  const overlay = createProfileSetupOverlay({
    address: myAddress,
    token,
    initialNickname: profile?.nickname ?? "",
    initialBio: profile?.bio ?? "",
    initialPrimary: profile?.primary_nft_contract_address && profile?.primary_nft_token_id
      ? {
        contract: profile.primary_nft_contract_address as `0x${string}`,
        tokenId: profile.primary_nft_token_id as string,
      }
      : null,
    onDone: () => {
      removeProfileOverlay();
    },
  });

  overlay.setAttribute("data-overlay", "profile-setup");
  document.body.appendChild(overlay);
  currentProfileOverlay = overlay;
}

function createProfileSetupOverlay(opts: {
  address: `0x${string}`;
  token: string;
  initialNickname: string;
  initialBio: string;
  initialPrimary: { contract: `0x${string}`; tokenId: string } | null;
  onDone: () => void;
}): HTMLElement {
  const { address, token, initialNickname, initialBio, initialPrimary, onDone } = opts;

  const backdrop = el("div.auth-overlay-backdrop");
  const card = el("div.auth-overlay-card");

  const title = el("div.auth-overlay-title", "프로필 설정");
  const desc = el(
    "div.auth-overlay-desc",
    "시고르에 접속하려면 프로필과 메인 NFT를 설정해야 함\n닉네임/자기소개를 입력하고, 보유 NFT 중 하나를 메인 캐릭터로 선택해"
  );

  const body = el("div.auth-overlay-body");

  // 입력 필드
  const nickname = el("div.profile-field",
    el("label", "닉네임"),
    el("input", { value: initialNickname, placeholder: "닉네임 (최대 30자)" }) as HTMLInputElement
  );

  const bio = el("div.profile-field",
    el("label", "자기소개"),
    el("textarea", { placeholder: "자기소개 (최대 200자)" }, initialBio) as HTMLTextAreaElement
  );

  // NFT 목록
  const nftTitle = el("div", { style: "font-size:12px;font-weight:900;color:#111;margin-top:4px;" }, "메인 캐릭터 선택");
  const nftHint = el("div.auth-overlay-hint", "※ 이미지가 안 보이면 해당 NFT 메타데이터/이미지 경로를 확인하세요.");

  const grid = el("div.profile-grid");
  const gridStatus = el("div", { style: "font-size:12px;color:#6b7280;font-weight:800;" }, "NFT 불러오는 중...");
  grid.append(gridStatus);

  let selected: { contract: `0x${string}`; tokenId: string } | null =
    initialPrimary ? { ...initialPrimary } : null;

  const saveBtn = el("button.auth-btn.primary", { type: "button", disabled: true }, "저장하고 계속하기") as HTMLButtonElement;

  function syncSaveEnabled() {
    const nn = (nickname.querySelector("input") as HTMLInputElement).value.trim();
    const bb = (bio.querySelector("textarea") as HTMLTextAreaElement).value.trim();
    const hasPrimary = !!selected?.contract && !!selected?.tokenId;

    // 닉네임/바이오는 선택이지만, primary는 필수로
    saveBtn.disabled = !hasPrimary || nn.length > 30 || bb.length > 200;
  }

  function renderNftCard(n: HeldNft) {
    const contract = getAddress(n.contract_addr ?? "0x0000000000000000000000000000000000000000");
    const tokenId = String(n.id ?? "");

    const name = n.type ? `${n.type} #${tokenId}` : `NFT #${tokenId}`;
    const imgUrl = toImageUrl(n.image);

    const cardEl = el("div.profile-nft", {
      dataset: { contract, tokenId },
      onclick: () => {
        // contract_addr 없는 데이터는 선택 불가
        if (!n.contract_addr) return;
        selected = { contract: contract as `0x${string}`, tokenId };
        // 스타일 반영
        Array.from(grid.querySelectorAll<HTMLElement>(".profile-nft")).forEach(x => x.removeAttribute("data-selected"));
        cardEl.setAttribute("data-selected", "1");
        syncSaveEnabled();
      }
    });

    if (selected?.contract === contract && selected?.tokenId === tokenId) {
      cardEl.setAttribute("data-selected", "1");
    }

    const img = el("img", { src: imgUrl, alt: name }) as HTMLImageElement;
    img.onerror = () => { img.style.display = "none"; };

    cardEl.append(
      img,
      el("div.meta", name)
    );

    return cardEl;
  }

  // 입력 이벤트
  (nickname.querySelector("input") as HTMLInputElement).addEventListener("input", syncSaveEnabled);
  (bio.querySelector("textarea") as HTMLTextAreaElement).addEventListener("input", syncSaveEnabled);

  // 저장
  saveBtn.onclick = async () => {
    saveBtn.setAttribute("data-loading", "1");
    try {
      const nn = (nickname.querySelector("input") as HTMLInputElement).value.trim();
      const bb = (bio.querySelector("textarea") as HTMLTextAreaElement).value.trim();

      if (!selected?.contract || !selected?.tokenId) {
        showErrorAlert("필수 설정", "메인 NFT를 선택해 주세요.");
        return;
      }

      await withLoading(card as HTMLElement, async () => {
        await setProfile({
          nickname: nn || undefined,
          bio: bb || undefined,
          primary_nft_contract_address: selected!.contract,
          primary_nft_token_id: selected!.tokenId,
        }, token);
      }, "프로필 저장 중...");

      onDone();
    } catch (err) {
      console.error(err);
      showErrorAlert("오류", err instanceof Error ? err.message : String(err));
    } finally {
      saveBtn.removeAttribute("data-loading");
      syncSaveEnabled();
    }
  };

  // NFT 로드
  void (async () => {
    try {
      const nfts = await fetchHeldNfts(address, {});
      grid.innerHTML = "";

      if (!nfts || nfts.length === 0) {
        grid.append(el("div", { style: "font-size:12px;color:#6b7280;font-weight:800;" }, "보유 NFT가 없습니다."));
        selected = null;
        syncSaveEnabled();
        return;
      }

      for (const n of nfts) grid.append(renderNftCard(n));

      // 처음 선택이 없으면 첫 번째(컨트랙트 있는 것) 자동 선택(UX)
      if (!selected) {
        const first = nfts.find(x => !!x.contract_addr);
        if (first?.contract_addr) {
          selected = { contract: getAddress(first.contract_addr) as `0x${string}`, tokenId: String(first.id ?? "") };
          // 첫 카드에 selected 표시
          const firstEl = grid.querySelector<HTMLElement>(`.profile-nft[data-contract="${selected.contract}"][data-token-id="${selected.tokenId}"]`);
          firstEl?.setAttribute("data-selected", "1");
        }
      }

      syncSaveEnabled();
    } catch (e) {
      console.error(e);
      grid.innerHTML = "";
      grid.append(el("div", { style: "font-size:12px;color:#b91c1c;font-weight:900;" }, "NFT를 불러오지 못했습니다."));
      selected = null;
      syncSaveEnabled();
    }
  })();

  body.append(
    nickname,
    bio,
    el("div.auth-overlay-divider"),
    nftTitle,
    grid,
    nftHint,
    el("div.auth-overlay-divider"),
    saveBtn,
  );

  card.append(title, desc, body);
  backdrop.append(card);

  // 초기 상태
  syncSaveEnabled();

  return backdrop as HTMLElement;
}

// 이벤트 기반 갱신 연결 (auth overlay 갱신 타이밍과 동일하게)
export function initProfileSetupOverlay() {
  window.addEventListener("googleSignInComplete", () => void refreshProfileSetupOverlay());
  window.addEventListener("googleSignOutComplete", () => void refreshProfileSetupOverlay());
}

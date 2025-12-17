import { logout, tokenManager } from "@gaiaprotocol/client-common";
import { el } from "@webtaku/el";
import { getAddress, isAddressEqual } from "viem";

import { fetchHeldNfts, HeldNft } from "../api/nfts";
import { fetchProfile, setProfile } from "../api/profile";
import { showErrorAlert } from "../components/alert";

import { googleLogout } from "../auth/google-login";
import "./auth-overlays.css";
import "./profile-setup-overlay.css";

let currentProfileOverlay: HTMLElement | null = null;

function removeProfileOverlay() {
  currentProfileOverlay?.remove();
  currentProfileOverlay = null;
}

/** ✅ 메인 캐릭터(Primary NFT)로 허용되는 컨트랙트 목록 */
const ALLOWED_PRIMARY_CONTRACTS = [
  "0xE47E90C58F8336A2f24Bcd9bCB530e2e02E1E8ae",
  "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
  "0x7340a44AbD05280591377345d21792Cdc916A388",
  "0xF967431fb8F5B4767567854dE5448D2EdC21a482",
  "0x595b299Db9d83279d20aC37A85D36489987d7660",
].map((a) => getAddress(a as `0x${string}`));

function isAllowedPrimaryContract(addr?: string | null): boolean {
  if (!addr) return false;
  try {
    const c = getAddress(addr as `0x${string}`);
    return ALLOWED_PRIMARY_CONTRACTS.some((x) => isAddressEqual(x, c));
  } catch {
    return false;
  }
}

// 상대/절대 경로 이미지 보정
function toImageUrl(img?: string | null) {
  if (!img) return "";
  try {
    return new URL(img).href;
  } catch {
    return `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/${img}`;
  }
}

/**
 * 프로필이 "접속 가능 상태"인지 판단
 * - primary_nft 존재 + 허용 컨트랙트여야 함
 */
function isProfileReady(p: any): boolean {
  const hasPrimary = !!(p?.primary_nft_contract_address && p?.primary_nft_token_id);
  if (!hasPrimary) return false;
  return isAllowedPrimaryContract(p.primary_nft_contract_address);
}

/**
 * 자동 갱신(로그인 직후 등)에서 호출:
 * - 미완료면 오버레이 표시
 * - 완료면 닫기
 */
export async function refreshProfileSetupOverlay() {
  await openProfileSetupOverlay(false);
}

/**
 * 강제/비강제 오픈 함수
 * - force=false: 프로필이 미완료일 때만 오픈
 * - force=true : 완료여도 무조건 오픈 (설정에서 "프로필 설정" 버튼용)
 */
export async function openProfileSetupOverlay(force = false) {
  // 토큰/주소 없으면 대상 아님
  const token = tokenManager.getToken();
  const addrRaw = tokenManager.getAddress();
  if (!token || !addrRaw) {
    removeProfileOverlay();
    return;
  }

  const myAddress = getAddress(addrRaw);

  // 프로필 로드
  let profile: any = null;
  try {
    profile = await fetchProfile(myAddress);
  } catch {
    profile = null;
  }

  // force가 아니면 준비됐을 때는 닫고 종료
  if (!force && isProfileReady(profile)) {
    removeProfileOverlay();
    return;
  }

  // 이미 떠 있으면 유지
  if (currentProfileOverlay) return;

  // initialPrimary는 "허용 컨트랙트"일 때만 인정
  const initialPrimary =
    profile?.primary_nft_contract_address &&
      profile?.primary_nft_token_id &&
      isAllowedPrimaryContract(profile.primary_nft_contract_address)
      ? {
        contract: getAddress(profile.primary_nft_contract_address as `0x${string}`),
        tokenId: String(profile.primary_nft_token_id),
      }
      : null;

  // 오버레이 생성
  const overlay = createProfileSetupOverlay({
    address: myAddress,
    token,
    initialNickname: profile?.nickname ?? "",
    initialBio: profile?.bio ?? "",
    initialPrimary,
    onDone: () => removeProfileOverlay(),
  });

  overlay.setAttribute("data-overlay", "profile-setup");
  document.body.appendChild(overlay);
  currentProfileOverlay = overlay;
}

async function withLoading<T>(
  cardEl: HTMLElement,
  fn: () => Promise<T>,
  msg = "처리 중..."
): Promise<T> {
  const loading = el(
    "div",
    { style: "font-size:12px;color:#6b7280;font-weight:800;margin-top:6px;" },
    msg
  );
  cardEl.appendChild(loading);
  try {
    return await fn();
  } finally {
    loading.remove();
  }
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
  const nicknameWrap = el(
    "div.profile-field",
    el("label", "닉네임"),
    el("input", {
      value: initialNickname,
      placeholder: "닉네임 (최대 30자)",
      maxLength: 30,
    }) as HTMLInputElement
  );

  const bioWrap = el(
    "div.profile-field",
    el("label", "자기소개"),
    el(
      "textarea",
      { placeholder: "자기소개 (최대 200자)", maxLength: 200 },
      initialBio
    ) as HTMLTextAreaElement
  );

  const nicknameInput = nicknameWrap.querySelector("input") as HTMLInputElement;
  const bioTextarea = bioWrap.querySelector("textarea") as HTMLTextAreaElement;

  // NFT 목록 영역
  const nftTitle = el(
    "div",
    { style: "font-size:12px;font-weight:900;color:#111;margin-top:4px;" },
    "메인 캐릭터 선택"
  );
  const nftHint = el(
    "div.auth-overlay-hint",
    "※ 아래 목록은 '메인 캐릭터로 사용 가능한 NFT 컨트랙트'만 표시됩니다."
  );

  const grid = el("div.profile-grid");
  grid.append(el("div", { style: "font-size:12px;color:#6b7280;font-weight:800;" }, "NFT 불러오는 중..."));

  let selected: { contract: `0x${string}`; tokenId: string } | null = initialPrimary
    ? { ...initialPrimary }
    : null;

  const saveBtn = el(
    "button.auth-btn.primary",
    { type: "button", disabled: true },
    "저장하고 계속하기"
  ) as HTMLButtonElement;

  const logoutBtn = el("button.auth-btn", { type: "button" }, "로그아웃") as HTMLButtonElement;

  logoutBtn.onclick = async () => {
    await logout().catch(() => { });
    await googleLogout().catch(() => { }); // 이미 해제된 경우 무시
    location.reload();
  };

  function syncSaveEnabled() {
    const nn = nicknameInput.value.trim();
    const bb = bioTextarea.value.trim();
    const hasPrimary = !!selected?.contract && !!selected?.tokenId;

    // 닉네임/바이오는 선택이지만, primary는 필수
    saveBtn.disabled = !hasPrimary || nn.length > 30 || bb.length > 200;
  }

  function clearSelectedStyles() {
    Array.from(grid.querySelectorAll<HTMLElement>(".profile-nft")).forEach((x) => {
      x.removeAttribute("data-selected");
    });
  }

  function renderNftCard(n: HeldNft) {
    const contract = n.contract_addr ? getAddress(n.contract_addr) : null;
    const tokenId = String(n.id ?? "");
    const name = n.type ? `${n.type} #${tokenId}` : `NFT #${tokenId}`;
    const imgUrl = toImageUrl(n.image);

    const cardEl = el("div.profile-nft", {
      dataset: { contract: contract ?? "", tokenId },
      onclick: () => {
        if (!contract) return;

        // 방어 로직(목록에서 이미 필터링했지만 혹시 몰라서)
        if (!isAllowedPrimaryContract(contract)) {
          showErrorAlert("선택 불가", "이 NFT는 메인 캐릭터로 사용할 수 없습니다.");
          return;
        }

        selected = { contract: contract as `0x${string}`, tokenId };
        clearSelectedStyles();
        cardEl.setAttribute("data-selected", "1");
        syncSaveEnabled();
      },
    }) as HTMLElement;

    if (selected?.contract === contract && selected?.tokenId === tokenId) {
      cardEl.setAttribute("data-selected", "1");
    }

    const img = el("img", { src: imgUrl, alt: name }) as HTMLImageElement;
    img.onerror = () => {
      img.style.display = "none";
    };

    cardEl.append(img, el("div.meta", name));
    return cardEl;
  }

  function renderNoNftMessage() {
    grid.innerHTML = "";

    const box = el(
      "div.profile-empty",
      el("div.title", "사용 가능한 NFT가 없습니다."),
      el(
        "div.desc",
        "메인 캐릭터로 사용할 수 있는 NFT가 필요합니다.\n아래 마켓에서 하나 구매해 본 뒤 다시 시도해 주세요."
      ),
      el(
        "div.actions",
        el(
          "a",
          {
            href: "https://matedevdao.github.io/kaia-nft-marketplace/",
            target: "_blank",
            rel: "noopener noreferrer",
            class: "auth-btn primary",
            style: "text-decoration:none;",
          },
          "NFT 구매하러 가기"
        ),
        el(
          "button",
          {
            type: "button",
            class: "auth-btn",
            onclick: () => void openProfileSetupOverlay(true),
          },
          "다시 불러오기"
        )
      )
    );

    grid.append(box);
  }

  // 입력 이벤트
  nicknameInput.addEventListener("input", syncSaveEnabled);
  bioTextarea.addEventListener("input", syncSaveEnabled);

  // 저장
  saveBtn.onclick = async () => {
    saveBtn.setAttribute("data-loading", "1");
    try {
      const nn = nicknameInput.value.trim();
      const bb = bioTextarea.value.trim();

      if (!selected?.contract || !selected?.tokenId) {
        showErrorAlert("필수 설정", "메인 NFT를 선택해 주세요.");
        return;
      }

      // 저장 직전에도 허용 컨트랙트 검증
      if (!isAllowedPrimaryContract(selected.contract)) {
        showErrorAlert("선택 불가", "선택한 NFT는 메인 캐릭터로 사용할 수 없습니다.");
        return;
      }

      await withLoading(
        card as HTMLElement,
        async () => {
          await setProfile(
            {
              nickname: nn || undefined,
              bio: bb || undefined,
              primary_nft_contract_address: selected!.contract,
              primary_nft_token_id: selected!.tokenId,
            },
            token
          );
        },
        "프로필 저장 중..."
      );

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
      const nftsAll = await fetchHeldNfts(address, {});
      const nfts = (nftsAll ?? []).filter((x) => isAllowedPrimaryContract(x.contract_addr ?? null));

      grid.innerHTML = "";

      if (!nfts || nfts.length === 0) {
        selected = null;
        renderNoNftMessage();
        syncSaveEnabled();
        return;
      }

      for (const n of nfts) grid.append(renderNftCard(n));

      // 처음 선택이 없으면 첫 번째 자동 선택
      if (!selected) {
        const first = nfts[0];
        if (first?.contract_addr) {
          selected = {
            contract: getAddress(first.contract_addr) as `0x${string}`,
            tokenId: String(first.id ?? ""),
          };

          const firstEl = grid.querySelector<HTMLElement>(
            `.profile-nft[data-contract="${selected.contract}"][data-token-id="${selected.tokenId}"]`
          );
          firstEl?.setAttribute("data-selected", "1");
        }
      }

      syncSaveEnabled();
    } catch (e) {
      console.error(e);
      grid.innerHTML = "";
      grid.append(
        el("div", { style: "font-size:12px;color:#b91c1c;font-weight:900;" }, "NFT를 불러오지 못했습니다.")
      );
      selected = null;
      syncSaveEnabled();
    }
  })();

  body.append(
    nicknameWrap,
    bioWrap,
    el("div.auth-overlay-divider"),
    nftTitle,
    grid,
    nftHint,
    el("div.auth-overlay-divider"),
    saveBtn,
    logoutBtn
  );

  card.append(title, desc, body);
  backdrop.append(card);

  // 초기 상태
  syncSaveEnabled();

  return backdrop as HTMLElement;
}

// 이벤트 기반 갱신 연결
export function initProfileSetupOverlay() {
  window.addEventListener("googleSignInComplete", () => void refreshProfileSetupOverlay());
  window.addEventListener("googleSignOutComplete", () => void refreshProfileSetupOverlay());
}

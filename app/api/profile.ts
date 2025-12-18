import { z } from "zod";

declare const MATE_API_BASE_URI: string;

export type Profile = {
  nickname?: string;
  bio?: string;
  primary_nft_contract_address?: `0x${string}`;
  primary_nft_token_id?: string;
};

const EthAddrSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((v) => v as `0x${string}`);

const ProfileSchema = z.object({
  nickname: z.string().optional(),
  bio: z.string().optional(),
  primary_nft_contract_address: EthAddrSchema.optional(),
  primary_nft_token_id: z.string().optional(),
});

export type SetProfilePayload = {
  nickname?: string;
  bio?: string;
  primary_nft_contract_address?: `0x${string}`;
  primary_nft_token_id?: string;
};

export type SetProfileResponse = { success: boolean };

export async function setProfile(
  payload: SetProfilePayload,
  token: string
): Promise<SetProfileResponse> {
  const res = await fetch(`${MATE_API_BASE_URI}/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`프로필 설정에 실패했습니다. (status: ${res.status})\n${text}`);

  try {
    const json = JSON.parse(text);
    if (typeof json.success === "boolean") return json as SetProfileResponse;
    throw new Error("서버 응답이 올바르지 않습니다.");
  } catch (e) {
    throw new Error(`응답 파싱 오류: ${(e as Error).message}`);
  }
}

export async function fetchProfile(address: `0x${string}`): Promise<Profile> {
  const res = await fetch(`${MATE_API_BASE_URI}/profile?address=${address}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`프로필 조회에 실패했습니다. (status: ${res.status})\n${text}`);

  try {
    const json = JSON.parse(text);
    const parsed = ProfileSchema.safeParse(json);
    if (!parsed.success) throw new Error("서버에서 잘못된 프로필 데이터를 반환했습니다.");
    return parsed.data;
  } catch (e) {
    throw new Error(`응답 파싱 오류: ${(e as Error).message}`);
  }
}

export async function fetchProfiles(
  addresses: (`0x${string}`)[]
): Promise<Record<`0x${string}`, Profile | null>> {
  const res = await fetch(`${MATE_API_BASE_URI}/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`프로필 조회에 실패했습니다. (status: ${res.status})\n${text}`);

  const json = JSON.parse(text);
  if (typeof json !== "object" || json === null) throw new Error("응답이 객체가 아닙니다.");

  const result: Record<`0x${string}`, Profile | null> = {};
  for (const [key, value] of Object.entries(json)) {
    if (typeof key !== "string" || !key.startsWith("0x")) continue;
    const parsed = ProfileSchema.safeParse(value);
    result[key as `0x${string}`] = parsed.success ? parsed.data : null;
  }
  return result;
}

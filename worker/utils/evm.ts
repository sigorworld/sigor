const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isValidEvmAddress(value: string | null): value is `0x${string}` {
  return !!value && EVM_ADDRESS_REGEX.test(value);
}

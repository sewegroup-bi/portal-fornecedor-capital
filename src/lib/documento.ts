export type DocumentoTipo = "CNPJ" | "CPF" | "INVALIDO";

export function apenasDigitos(v: string): string {
  return String(v ?? "").replace(/\D/g, "");
}

function digitosVerificadoresCnpj(base: string): boolean {
  const calc = (len: number) => {
    let peso = len - 7;
    let soma = 0;
    for (let i = 0; i < len; i++) {
      soma += Number(base[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    calc(12) === Number(base[12]) && calc(13) === Number(base[13])
  );
}

function digitosVerificadoresCpf(base: string): boolean {
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(base[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(base[9]) && calc(10) === Number(base[10]);
}

// Classifica e valida (inclui dígitos verificadores, para pegar erro de digitação).
export function validarDocumento(valor: string): {
  tipo: DocumentoTipo;
  digitos: string;
  valido: boolean;
  motivo?: string;
} {
  const d = apenasDigitos(valor);

  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d))
      return { tipo: "INVALIDO", digitos: d, valido: false, motivo: "CNPJ inválido" };
    return digitosVerificadoresCnpj(d)
      ? { tipo: "CNPJ", digitos: d, valido: true }
      : {
          tipo: "INVALIDO",
          digitos: d,
          valido: false,
          motivo: "CNPJ inválido (dígito verificador não confere)",
        };
  }

  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d))
      return { tipo: "INVALIDO", digitos: d, valido: false, motivo: "CPF inválido" };
    return digitosVerificadoresCpf(d)
      ? { tipo: "CPF", digitos: d, valido: true }
      : {
          tipo: "INVALIDO",
          digitos: d,
          valido: false,
          motivo: "CPF inválido (dígito verificador não confere)",
        };
  }

  return {
    tipo: "INVALIDO",
    digitos: d,
    valido: false,
    motivo: `Documento deve ter 14 dígitos (CNPJ) ou 11 (CPF) — recebido ${d.length}`,
  };
}

// 12345678000199 -> 12.345.678/0001-99 ; 12345678901 -> 123.456.789-01
export function formatarDocumento(digitos: string): string {
  const d = apenasDigitos(digitos);
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return digitos;
}

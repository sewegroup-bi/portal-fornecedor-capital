import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarDocumento, formatarDocumento } from "@/lib/documento";

export const runtime = "nodejs";

// Corrige o documento (CNPJ/CPF) de um fornecedor. Só admin.
// Escreve via service_role: fornecedores não têm policy de escrita.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) {
    return NextResponse.json({ erro: "Acesso restrito a administradores" }, { status: 403 });
  }

  let body: { fornecedor_id?: string; documento?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida" }, { status: 400 });
  }

  const { fornecedor_id, documento } = body;
  if (!fornecedor_id || !documento) {
    return NextResponse.json(
      { erro: "Informe o fornecedor e o documento" },
      { status: 400 }
    );
  }

  const v = validarDocumento(documento);
  if (!v.valido) {
    return NextResponse.json({ erro: v.motivo }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from("fornecedores")
    .update({
      documento: formatarDocumento(v.digitos),
      documento_tipo: v.tipo,
      cnpj: v.tipo === "CNPJ" ? v.digitos : null,
    })
    .eq("id", fornecedor_id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    tipo: v.tipo,
    documento: formatarDocumento(v.digitos),
  });
}

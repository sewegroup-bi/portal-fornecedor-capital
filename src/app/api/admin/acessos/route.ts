import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Não autenticado", status: 401 as const };
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) return { erro: "Acesso restrito a administradores", status: 403 as const };
  return { user, supabase };
}

// POST: convida o fornecedor por e-mail (ou vincula, se já tiver conta)
export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if ("erro" in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status });

  const { fornecedor_id, email } = (await req.json().catch(() => ({}))) as {
    fornecedor_id?: string;
    email?: string;
  };

  if (!fornecedor_id || !email || !email.includes("@")) {
    return NextResponse.json({ erro: "Informe o fornecedor e um e-mail válido" }, { status: 400 });
  }

  const destino = email.trim().toLowerCase();
  const db = createAdminClient();
  const redirectTo = `${req.nextUrl.origin}/auth/confirm`;

  let userId: string | null = null;
  let mensagem = "Convite enviado.";

  const { data: convite, error: erroConvite } = await db.auth.admin.inviteUserByEmail(
    destino,
    { redirectTo }
  );

  if (convite?.user) {
    userId = convite.user.id;
  } else {
    // já existe conta com esse e-mail: vincula e manda link para definir a senha
    const { data: existente } = await auth.supabase.rpc("usuario_id_por_email", {
      p_email: destino,
    });

    if (!existente) {
      return NextResponse.json(
        { erro: erroConvite?.message ?? "Não foi possível convidar este e-mail" },
        { status: 400 }
      );
    }

    userId = existente as string;
    await db.auth.resetPasswordForEmail(destino, { redirectTo });
    mensagem = "Usuário já existia: vinculado e e-mail de acesso reenviado.";
  }

  // um login pertence a um único fornecedor: avisa em vez de mover silenciosamente
  const { data: vinculo } = await db
    .from("fornecedor_usuarios")
    .select("fornecedor_id, fornecedores(nome)")
    .eq("user_id", userId)
    .maybeSingle();

  if (vinculo && vinculo.fornecedor_id !== fornecedor_id) {
    const outro =
      (vinculo.fornecedores as { nome?: string } | null)?.nome ?? "outro fornecedor";
    return NextResponse.json(
      {
        erro: `Este e-mail já tem acesso vinculado a ${outro}. Use um e-mail diferente para este fornecedor.`,
      },
      { status: 409 }
    );
  }

  const { error } = await db.from("fornecedor_usuarios").upsert(
    {
      user_id: userId,
      fornecedor_id,
      email: destino,
      ativo: true,
      convidado_em: new Date().toISOString(),
      criado_por: auth.user.id,
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, mensagem });
}

// PATCH: corta ou reativa o acesso
export async function PATCH(req: NextRequest) {
  const auth = await exigirAdmin();
  if ("erro" in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status });

  const { user_id, ativo } = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    ativo?: boolean;
  };

  if (!user_id || typeof ativo !== "boolean") {
    return NextResponse.json({ erro: "Requisição inválida" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("fornecedor_usuarios")
    .update({ ativo })
    .eq("user_id", user_id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    mensagem: ativo ? "Acesso reativado." : "Acesso cortado.",
  });
}

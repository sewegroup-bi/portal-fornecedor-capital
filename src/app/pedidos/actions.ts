"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemInput = { produto_id: string; quantidade: number };

export async function criarPedido(input: {
  itens: ItemInput[];
  observacao: string;
  ciente: boolean;
}): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  // O custo e o total são calculados no banco (RPC), nunca no cliente.
  const { error } = await supabase.rpc("criar_pedido", {
    p_itens: input.itens,
    p_observacao: input.observacao,
    p_ciente: input.ciente,
  });

  if (error) {
    return { ok: false, erro: error.message };
  }

  revalidatePath("/pedidos");
  return { ok: true };
}

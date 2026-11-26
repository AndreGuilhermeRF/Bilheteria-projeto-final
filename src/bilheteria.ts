import { DadosInvalidosErro, Evento, NaoEncontradoErro, PagamentoErro } from "./dominio.ts";
import type { Pagamento } from "./pagamento.ts";
import { calcularTotal, montarIngressos } from "./preco.ts";
import { direitoAMeia } from "./regras.ts";
import type { Comprovante, ConfigBilheteria, EventoInfo, Pedido } from "./tipos.ts";

function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
let timer: ReturnType<typeof setTimeout> | undefined;
const limite = new Promise<never>((_, rejeitar) => {
timer = setTimeout(() => rejeitar(new Error("tempo esgotado")), ms);
});
return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

export class Bilheteria {
readonly #eventos: Evento[];
readonly #pagar: Pagamento;
readonly #limitePagamentoMs: number;
#proximaReserva = 1;

constructor({ eventos, pagar, limitePagamentoMs }: ConfigBilheteria) {
this.#eventos = eventos;
this.#pagar = pagar;
this.#limitePagamentoMs = limitePagamentoMs;
}

listarEventos(): EventoInfo[] {
return this.#eventos.map((evento) => evento.info());
}

async reservar(pedido: Pedido): Promise<Comprovante> {
if (!pedido || !Array.isArray(pedido.ingressos) || pedido.ingressos.length === 0) {
throw new DadosInvalidosErro("o pedido precisa de ao menos um ingresso");
}
const evento = this.#eventos.find((e) => e.id === pedido.eventoId);
if (!evento) {
throw new NaoEncontradoErro(`evento ${pedido.eventoId} não existe`);
}

const poltronas = pedido.ingressos.map((pessoa) => pessoa.poltrona);
evento.reservar(poltronas);

const ingressos = montarIngressos(evento.preco, pedido.ingressos, direitoAMeia);
const total = calcularTotal(ingressos);

try {
await comTempoLimite(this.#pagar(total), this.#limitePagamentoMs);
} catch (erro) {
evento.liberar(poltronas);
const motivo = erro instanceof Error ? erro.message : "erro desconhecido";
throw new PagamentoErro(`pagamento não aprovado: ${motivo}`);
}

return {
reservaId: this.#proximaReserva++,
eventoId: evento.id,
ingressos,
total,
};
}
}

export function criarBilheteria(config: ConfigBilheteria): Bilheteria {
return new Bilheteria(config);
}

# Bilheteria concorrente

Projeto final de Paradigmas de Linguagens de Programação. Enunciado completo no Blackboard.

Os arquivos de `src/` que vocês escrevem já existem, vazios; o `tipos.ts` e o `servidor.ts` vêm prontos. O que vai em cada um está no passo
indicado do enunciado:

| Arquivo | Passo do enunciado |
| :--- | :--- |
| `src/tipos.ts` (pronto) | 1: os tipos |
| `src/regras.ts` | 2: meia-entrada |
| `src/preco.ts` | 3: preço (funcional) |
| `src/dominio.ts` | 4: evento e erros (orientado a objetos) |
| `src/bilheteria.ts` | 5: a venda, onde a concorrência aparece |
| `src/servidor.ts` (pronto) e `src/main.ts` | 6: ligar o servidor |

Não alterem `src/pagamento.ts`, `src/servidor.ts`, `src/bench.ts` nem `testes/`: a correção usa os originais.

Para começar, sigam o `GUIA.md`. Depois dele, os comandos são:

```bash
npm install
npm test          # correção automática: mostra os pontos
npm start         # serviço em http://localhost:3000
npm run bench     # com o serviço no ar: 200 pedidos simultâneos no evento 1, dois por poltrona
```

Exemplo de pedido:

```bash
curl.exe localhost:3000/eventos
$corpo = '{"eventoId":2,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
$corpo | curl.exe -X POST localhost:3000/reservas -H "Content-Type: application/json" --data-binary "@-"
```

---

## Preencham (avaliado no vídeo)

**Link do vídeo:** https://drive.google.com/file/d/1bUxrDDwUiHT5rGitplPknEl1xbPPhDfx/view?usp=drive_link

### Integrantes

| Nome | Usuário do GitHub | Parte principal |
| :--- | :--- | :--- |
| André Guilherme Ribeiro Fernandes | AndreGuilhermeRF | regras.ts,main.ts,README |
| Giovanna Vogeley Maciel | GiovannaVM | preco.ts |
| Pedro Henrique Gomes da Silva Morais | PedroM0rais | dominio.ts |
| Yann Wanderley Cruz Lopes | wclyann | bilheteria.ts|

### Decisões

1. **Concorrência.** Como vocês garantem que duas pessoas não ficam com a mesma poltrona? Onde estava o
   `await` perigoso?

   O `Bilheteria.reservar` marca as poltronas com `evento.reservar(poltronas)` **antes** do `await` do pagamento. Esse
   trecho (conferir + marcar) é síncrono: o Node só troca de pedido num `await`, então dois pedidos nunca
   estão ao mesmo tempo entre "conferi que está livre" e "marquei como vendida". Por isso não precisamos de fila nem de trava.
   O `await` perigoso é o do `pagar(total)`: ele demora (e pode travar), e é nele que o Node atende os outros pedidos.
   Se as poltronas só fossem marcadas depois dele, dois pedidos veriam a mesma poltrona livre, os dois pagariam e o
   segundo marcaria uma poltrona que já tinha dono (gente cobrada sem poltrona). Se o pagamento falha ou estoura o
   tempo limite, as poltronas voltam para a venda com `evento.liberar`.

2. **OO.** O que o `Evento` esconde e por quê? Por que o `reservar` é tudo ou nada? Por que os erros são uma hierarquia de classes?

   O `Evento` esconde a lista de poltronas vendidas num campo `#` e só expõe `disponivel` (getter sem setter), então
   ninguém de fora consegue marcar ou desmarcar poltronas sem passar pelas regras do `reservar` e do `liberar`. O
   `reservar` é tudo ou nada porque um pedido é de uma família: se uma poltrona do grupo já foi vendida, vender só
   parte deixaria um pedido pela metade, que o cliente não quer e que teríamos de desfazer. Por isso ele confere todas
   as poltronas primeiro e só depois marca. Os erros são uma hierarquia (`ErroDeNegocio` e quatro filhas) porque
   cada um guarda o próprio status HTTP: o servidor trata todos com um único `instanceof ErroDeNegocio` e usa
   `erro.status`, e um erro novo não obriga a mexer no servidor.

3. **Funcional.** O que ganhamos com `preco.ts` puro? Como vocês testariam ele sem subir o servidor?

   Funções puras sempre devolvem o mesmo resultado para a mesma entrada e não mudam nada fora delas. Dá para
   raciocinar sobre elas isoladamente, não têm problema com concorrência (não há estado compartilhado) e são fáceis de
   testar. Para testar sem servidor basta importar e chamar, por exemplo `calcularTotal` com ingressos de 50 e 100 e conferir
   165, ou `montarIngressos` passando outra regra de meia. É isso que o `npm test` faz.

4. **Se fosse em outro paradigma.** Escolham uma das partes e expliquem como ficaria em outro
   paradigma, e se ficaria melhor ou pior.

   O preço em estilo imperativo teria um `let total = 0`, um `for` percorrendo os ingressos e um `if` para a meia.
   Funciona e para esse tamanho até é fácil de ler, mas mistura "montar o ingresso" com "somar" no mesmo laço, a regra
   de meia fica presa dentro dele (no funcional ela é recebida como parâmetro) e o estado mutável atrapalharia
   se o cálculo um dia fosse compartilhado entre tarefas. Para esta parte, o funcional ficou melhor.

5. **Concorrente × paralelo.** O Node roda o JavaScript numa linha só: os pedidos de vocês são
   concorrentes, não paralelos. O que mudaria se a venda rodasse em vários núcleos ao mesmo tempo?

   Hoje a garantia vem de graça: conferir e marcar a poltrona acontece sem interrupção, porque só uma linha executa
   JavaScript. Com vários núcleos, duas threads poderiam conferir a mesma poltrona livre ao mesmo tempo e as duas
   marcá-la (condição de corrida). Aí seria preciso uma trava (mutex) ou uma operação atômica em volta do
   "conferir e marcar", ou então uma única thread dona do estado do evento, com as outras mandando mensagens para ela. Também
   teríamos de cuidar de deadlock e de o estado ficar compartilhado entre threads.

### Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 290 | 86 | 99 | 15 |

O bench ocupa as poltronas do evento 1: para rodar de novo, parem o `npm start` (Ctrl+C) e subam outra
vez.

O que os números mostram:

Foram 200 pedidos disparados juntos, dois para cada uma das 100 poltronas do evento 1. Nenhuma poltrona foi vendida duas
vezes: cada poltrona tem no máximo um 201, e o segundo pedido dela volta 409 (perto de 100 no total). Os 502 (perto de 10%,
a taxa de falha da operadora falsa) são pedidos cuja cobrança falhou: eles não deixam a poltrona presa, porque ela
volta para a venda. Por isso os vendidos ficam em torno de 90 e não em 100. Os números mudam um pouco a cada execução porque a operadora falha
de forma aleatória. Os 200 pedidos levaram menos de 300 ms, e não 200 × 80 ms = 16 s, porque o Node atende os outros pedidos enquanto cada um espera
a operadora no `await`.
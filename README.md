# Dominó 3D

Dominó mano a mano contra a IA, no navegador, com peças modeladas em 3D e iluminação de estúdio (Three.js + Vite + TypeScript).

[Jogar online](https://dellanio.github.io/game-domino-3D/) · [Código no GitHub](https://github.com/dellanio/game-domino-3D)

## Como rodar

```bash
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
```

Outros comandos: `npm test` (regras, IA e posicionamento), `npm run build` (gera `dist/`).

## Regras

- 28 peças. O menu oferece Clássico (7 pedras por jogador e 14 no monte), Rápido (3 por jogador e 22 no monte) e Compacto (5 por jogador e 18 no monte).
- Na primeira rodada começa quem tem a maior dobrada (sem dobradas, a peça mais pesada). Depois, começa quem venceu a rodada anterior.
- Sem peça que encaixe: compra do monte até conseguir jogar. Monte vazio: passa a vez.
- **Batida:** quem acaba as peças ganha os pontos que sobraram na mão do adversário.
- **Jogo fechado** (ninguém consegue jogar): ganha quem tem menos pontos na mão e leva os pontos do outro. Empate não pontua.
- A partida vai até 100 pontos.

## Como jogar

- Escolha o modo no menu e pressione **Jogar**: a distribuição só começa depois disso. Use Tab para navegar e as setas para selecionar os cartões de modo.
- O modo aparece durante a partida e continua nas próximas rodadas e em **Nova partida**. **Voltar ao menu** encerra a sessão atual e permite escolher novamente, reiniciando o placar ao jogar.

- Clique numa peça destacada da sua mão. Se ela servir nas duas pontas, aparecem duas marcas douradas na mesa: clique onde quer jogar.
- Arraste para girar a câmera e use a roda do mouse para aproximar.

## Estrutura

- `src/game/rules.ts`: regras (lógica pura, sem 3D)
- `src/game/ai.ts`: heurística da IA (descarta peças pesadas, não se tranca, corta números que você mostrou não ter)
- `src/game/layout.ts`: posição das peças na corrente, com curvas nas bordas
- `src/render/`: peças 3D, mesa, luzes e animações
- `src/main.ts`: controlador do jogo e interface

## Música de fundo

“Backbay Lounge”, Kevin MacLeod (incompetech.com), CC BY 4.0. Créditos e links estão na página acessível pelo ícone de informação ao fim da rodada e em `public/audio/ATTRIBUTION.txt`. A música começa após interação, repete em volume baixo e pausa ao ocultar a aba. O botão de alto-falante liga ou desliga música e efeitos juntos e salva a preferência. O impacto de cada pedra usa o arquivo curto de áudio fornecido pelo usuário (`public/audio/pedra-na-mesa-curto.mp3`), em volume baixo, sincronizado com o fim da animação de pouso. O áudio `public/audio/som-inicial-2.mp3`, também fornecido pelo usuário, toca uma vez no começo da animação de reunião das pedras de cada rodada e para ao voltar ao menu ou silenciar.

## Temas

Antes dos modos, escolha **Default** (visual clássico original) ou **Brasil** (concreto, creme, azul royal e latão fosco, com a marca Brasil Edition). A prévia muda imediatamente no menu; as peças só são distribuídas ao pressionar **Jogar**. O tema também aparece na mesa, nas peças e no HUD, sem alterar regras ou modos.

A primeira visita usa Default. A escolha fica salva apenas neste navegador, na chave `domino-3d-theme` do armazenamento local. Se o armazenamento estiver bloqueado, a seleção funciona durante a sessão. Voltar ao menu mantém a escolha; selecione Default para recuperar o visual original, inclusive depois de uma partida Brasil. Tab e as setas navegam pelos seletores de tema e modo.

O cenário Brasil inclui calçada portuguesa em ondas, cadeiras monobloco, copo americano com cerveja e espuma, porta-copos vermelho e petiscos na borda externa. Uma amendoeira e um muro de reboco compõem o fundo, sob iluminação quente de fim de tarde. Texturas e modelos são gerados localmente, sem downloads durante a partida. As pedras azuis têm pontos brancos; a música deste tema é o áudio “Pedras na Mesa” fornecido pelo usuário. O enquadramento no desktop é mais aberto para mostrar o entorno; arraste para girar a câmera ou use a roda para aproximar.

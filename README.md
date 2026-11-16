# Dominó 3D

Dominó mano a mano contra a IA, no navegador, com peças modeladas em 3D e iluminação de estúdio (Three.js + Vite + TypeScript).

## Como rodar

```bash
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
```

Outros comandos: `npm test` (regras, IA e posicionamento), `npm run build` (gera `dist/`).

## Regras

- 28 peças. O menu oferece Clássico (7 pedras), Rápido (3) e Compacto (5) como mão inicial; as restantes ficam no monte. Os tamanhos alternativos dependem da integração das regras com `handSize`.
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

“Backbay Lounge”, Kevin MacLeod (incompetech.com), CC BY 4.0. Créditos e links estão na página acessível pelo ícone de informação ao fim da rodada e em `public/audio/ATTRIBUTION.txt`. A música começa após interação, repete em volume baixo e pausa ao ocultar a aba. O botão de alto-falante liga ou desliga música e efeitos juntos e salva a preferência. O impacto de cada pedra é sintetizado localmente e sincronizado com o fim da animação de pouso.

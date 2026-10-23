export interface Reward {
  id: string;
  title: string;
  description: string;
  costPoints: number;
  category: 'hotel' | 'restaurante' | 'experiencia' | 'desconto';
}

// Espelha o rewardsCatalog do mockData.ts da app. O servidor e a fonte da verdade do custo.
export const REWARDS_CATALOG: Reward[] = [
  { id: 'r1', title: '10% desconto - Hotel Presidente', description: 'Valido para estadias de 1 a 3 noites.', costPoints: 500, category: 'hotel' },
  { id: 'r2', title: 'Sobremesa gratis - Restaurante Miradouro', description: 'Numa refeicao para 2 pessoas.', costPoints: 150, category: 'restaurante' },
  { id: 'r3', title: 'Passeio de barco - Ilha de Luanda', description: '15% de desconto no passeio ao por do sol.', costPoints: 800, category: 'experiencia' },
  { id: 'r4', title: '500 Kz de desconto na proxima viagem', description: 'Aplica automaticamente na tua carteira AngoTour.', costPoints: 300, category: 'desconto' },
  { id: 'r5', title: 'Entrada dupla - Museu Nacional', description: 'Valida por 30 dias apos o resgate.', costPoints: 250, category: 'experiencia' },
];

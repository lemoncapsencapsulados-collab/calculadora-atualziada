// Sabores que a fábrica faz de rotina.
//
// Estavam escritos à mão seis vezes — três formas (gummy, solúvel, líquido)
// em duas telas (Aprovação e Projeto para Contrato) que gravam nos MESMOS
// campos de `detalhesProducao`. Incluir um sabor numa cópia e esquecer a
// outra fazia a segunda tela mostrar o campo vazio para o mesmo pedido.
//
// A lista é o comum, não o limite: os dois formulários oferecem
// "Personalizado…" para o sabor que o cliente pedir e a fábrica aceitar.

/** Gummy tem carta própria: a massa aceita sabores que o pó não aceita. */
export const SABORES_GUMMY = ['Frutas vermelhas', 'Morango', 'Uva', 'Limão', 'Maçã verde'];

/** Solúvel e líquido compartilham a mesma carta. */
export const SABORES_SOLUVEL_LIQUIDO = ['Limão', 'Frutas vermelhas', 'Morango', 'Uva'];

export const DATAPREV_2026_CYCLE = [
  "Desenvolvimento", "Português", "Banco de Dados", "Engenharia de Software", "Redes",
  "Segurança da Informação", "Inglês", "Desenvolvimento", "Banco de Dados", "Raciocínio Lógico",
  "Engenharia de Software", "Português", "Redes", "Sistemas Operacionais", "Segurança da Informação",
  "Governança de TI", "Desenvolvimento", "Banco de Dados", "LGPD / Marco Civil", "Atualidades + IA",
] as const;

type SourceSubject = readonly [string, number, string];

// Fonte: Modelo_Ciclo_DATAPREV_Ponderado.xlsx e modelo-ciclo-dataprev-preenchido.csv.
export const DATAPREV_2026_SUBJECTS: Record<string, SourceSubject[]> = {
  "Português": [["Interpretação de Textos", 3, "Português > Interpretação de Textos"], ["Coesão e Coerência", 2, "Português > Coerência e Coesão"], ["Tipologia e Gênero Textual", 1, "Português > Tipologia e Gênero Textual"], ["Reescrita de Frases", 2, "Português > Reescrita de Frases"]],
  "Inglês": [["Interpretação de Textos", 2, "Inglês > Interpretação de Textos"], ["Gramática", 1, "Inglês > Gramática"], ["Semântica e Vocabulário", 1, "Inglês > Semântica e Significado de Vocábulos"]],
  "Raciocínio Lógico": [["Lógica de Proposições", 2, "Raciocínio Lógico > Lógica de Proposições"], ["Sequências", 1, "Raciocínio Lógico > Sequências"], ["Orientação no Plano, Espaço e Tempo", 1, "Raciocínio Lógico > Orientação no Plano, Espaço e Tempo"], ["Datas e Calendários", 1, "Raciocínio Lógico > Datas e Calendários"]],
  "Banco de Dados": [["Linguagem SQL", 3, "TI - Banco de Dados > Linguagem SQL"], ["SGBD Relacionais", 3, "TI - Banco de Dados > SGBD Relacionais"], ["Projeto e Modelagem de Dados", 2, "TI - Banco de Dados > Projeto e Modelagem de Dados"], ["Bancos de Dados Especializados", 1, "TI - Banco de Dados > Outros Modelos/Bancos Especializados"]],
  "Desenvolvimento": [["Desenvolvimento Web", 3, "TI - Desenvolvimento de Sistemas > Desenvolvimento Web"], ["APIs, REST e Web Services", 3, "TI - Desenvolvimento de Sistemas > Web Services e APIs"], ["Linguagens de Programação", 2, "TI - Desenvolvimento de Sistemas > Linguagens de Programação"], ["Algoritmos e Lógica de Programação", 2, "TI - Desenvolvimento de Sistemas > Algoritmos e Lógica"], ["Arquitetura de Aplicações", 2, "TI - Desenvolvimento de Sistemas > Arquitetura de Aplicações"]],
  "Engenharia de Software": [["Ciclo de Vida e Metodologias", 2, "TI - Engenharia de Software > Modelos de Ciclo de Vida e Metodologias"], ["Engenharia de Requisitos", 2, "TI - Engenharia de Software > Engenharia de Requisitos"], ["Testes de Software", 2, "TI - Engenharia de Software > Testes de Software"], ["Qualidade e Métricas", 2, "TI - Engenharia de Software > Qualidade/Métricas"], ["UML e Modelagem", 1, "TI - Engenharia de Software > UML/Técnicas de Modelagem"], ["Padrões de Projeto", 1, "TI - Engenharia de Software > Padrões de Projeto"], ["Gestão de Projetos (PMBOK)", 1, "Gestão de Projetos > PMBOK"]],
  "Redes": [["Principais Protocolos de Redes", 3, "TI - Redes de Computadores > Principais Protocolos"], ["Gerenciamento de Redes", 2, "TI - Redes de Computadores > Gerenciamento de Redes"], ["Modelos de Referência", 1, "TI - Redes de Computadores > Modelos de Referência"], ["Internet", 1, "TI - Redes de Computadores > Internet"], ["Componentes Físicos", 1, "TI - Redes de Computadores > Componentes Físicos"], ["Armazenamento e Processamento em Redes", 1, "TI - Redes de Computadores > Armazenamento e Processamento"]],
  "Segurança da Informação": [["Recursos e Ferramentas de Segurança", 3, "TI - Segurança da Informação > Recursos e Ferramentas"], ["Gestão da Segurança da Informação", 2, "TI - Segurança da Informação > Gestão da Segurança"], ["Criptografia", 2, "TI - Segurança da Informação > Criptografia"], ["Ameaças aos Sistemas Computacionais", 2, "TI - Segurança da Informação > Ameaças"], ["Frameworks de Segurança", 1, "TI - Segurança da Informação > Frameworks"]],
  "Sistemas Operacionais": [["Virtualização e Sistemas Distribuídos", 2, "TI - Sistemas Operacionais > Virtualização e Sistemas Distribuídos"], ["Windows", 1, "TI - Sistemas Operacionais > Windows"], ["Unix e Linux", 1, "TI - Sistemas Operacionais > Unix e Linux"], ["Sistemas de Arquivos", 1, "TI - Sistemas Operacionais > Sistemas de Arquivos"]],
  "Governança de TI": [["ITIL", 2, "TI - Gestão e Governança de TI > ITIL"], ["COBIT", 2, "TI - Gestão e Governança de TI > COBIT"], ["Gerenciamento de Processos de Negócio", 2, "TI - Gestão e Governança de TI > Gerenciamento de Processos"], ["Contratação e Fiscalização de TI", 1, "TI - Gestão e Governança de TI > Contratação e Fiscalização"]],
  "LGPD / Marco Civil": [["LGPD", 2, "Direito Digital > LGPD"], ["Marco Civil da Internet", 1, "Direito Digital > Marco Civil da Internet"], ["Lei de Acesso à Informação", 1, "Direito Administrativo > Acesso à Informação"]],
  "Atualidades + IA": [["Inteligência Artificial", 2, "TI - Ciência de Dados e IA > Inteligência Artificial"], ["Política", 1, "Atualidades > Política"], ["Economia", 1, "Atualidades > Economia"], ["Ciência e Tecnologia", 1, "Atualidades > Ciência e Tecnologia"]],
};

export function defaultQuestionGoal(discipline: string) {
  return discipline === "Português" || discipline === "Inglês" ? 15 : 20;
}

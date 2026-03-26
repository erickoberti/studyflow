import { NextResponse } from "next/server";
import Papa from "papaparse";

export async function GET() {
  const csv = Papa.unparse([
    {
      Seq: 1,
      Assunto: "Conjuntos",
      Peso: 2,
      Disciplina: "Matematica",
      "Onde marcar no TEC": "Matematica > Conjuntos",
    },
    {
      Seq: 2,
      Assunto: "Porcentagem",
      Peso: 3,
      Disciplina: "Matematica",
      "Onde marcar no TEC": "Matematica > Porcentagem",
    },
    {
      Seq: 3,
      Assunto: "Interpretacao de Textos",
      Peso: 2,
      Disciplina: "Portugues",
      "Onde marcar no TEC": "Portugues > Interpretacao de Textos",
    },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-ciclo.csv"',
    },
  });
}

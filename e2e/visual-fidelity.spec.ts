import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

// Visual and interaction checks are separate from the real service-worker E2E.
test.use({ serviceWorkers: "block" });


const fixturePrisma = new PrismaClient();
let fixtureUserId = "";
test.beforeAll(async () => {
  expect(process.env.DATABASE_URL).toContain("127.0.0.1:55432/");
  const user = await fixturePrisma.user.create({ data: { name: "Aluno de teste", email: `stitch-${Date.now()}@example.test`, passwordHash: "unused-visual-fixture", settings: { create: {} } } });
  fixtureUserId = user.id;
  const guide = await fixturePrisma.studyGuide.create({ data: { userId: user.id, name: "Guia de validação visual" } });
  await fixturePrisma.user.update({ where: { id: user.id }, data: { activeStudyGuideId: guide.id } });
  for (const [index, item] of [["Banco de Dados", "Ferramentas Analytics: ETL, BI e Big Data"], ["Língua Inglesa", "Compreensão e gramática aplicada ao texto técnico"], ["Segurança da Informação", "Criptografia assimétrica e assinaturas digitais"], ["Redes de Computadores", "Arquitetura TCP/IP e protocolos de aplicação"]].entries()) {
    const discipline = await fixturePrisma.discipline.create({ data: { userId: user.id, studyGuideId: guide.id, name: item[0], sortOrder: index + 1, questionGoal: 20 } });
    const subject = await fixturePrisma.subject.create({ data: { userId: user.id, studyGuideId: guide.id, disciplineId: discipline.id, name: item[1], weight: index === 1 ? 1 : 2, notes: "Observação de teste: revisar conceitos e resolver questões comentadas." } });
    const entry = await fixturePrisma.cycleEntry.create({ data: { userId: user.id, studyGuideId: guide.id, disciplineId: discipline.id, subjectId: subject.id, orderIndex: index + 1 } });
    await fixturePrisma.studySession.create({ data: { userId: user.id, studyGuideId: guide.id, subjectId: subject.id, cycleEntryId: entry.id, date: new Date(Date.now() - index * 86_400_000), questions: 20, correct: 15, wrong: 5, percentage: 75, estimatedMinutes: 45, activityType: "QUESTIONS", scope: "CYCLE" } });
    await fixturePrisma.subjectProgress.create({ data: { userId: user.id, studyGuideId: guide.id, subjectId: subject.id, totalQuestions: 20, correct: 15, wrong: 5, averagePercentage: 75, lastStudiedAt: new Date() } });
    await fixturePrisma.reviewSchedule.create({ data: { userId: user.id, studyGuideId: guide.id, subjectId: subject.id, dueAt: new Date(Date.now() + (index < 2 ? -1 : 7) * 86_400_000), intervalDays: index < 2 ? 1 : 7 } });
  }
});
test.afterAll(async () => {
  if (fixtureUserId) await fixturePrisma.user.delete({ where: { id: fixtureUserId } });
  await fixturePrisma.$disconnect();
});

test("fidelidade: densidade, largura, superfícies e modal em três viewports", async ({page,context}) => {
 test.setTimeout(180000);
 const user=await fixturePrisma.user.findUniqueOrThrow({where:{id:fixtureUserId}});
 const discipline=await fixturePrisma.discipline.findFirstOrThrow({where:{userId:fixtureUserId}});
 for(let i=5;i<=12;i++) {
  const subject=await fixturePrisma.subject.create({data:{userId:user.id,studyGuideId:user.activeStudyGuideId!,disciplineId:discipline.id,name:["Modelagem, normalização e SQL ANSI","NoSQL, bancos distribuídos e otimização","Qualidade de software, métricas e arquitetura ágil","Protocolos, roteamento e serviços de rede"][(i-5)%4]+" · bloco "+i,weight:1.5}});
  await fixturePrisma.cycleEntry.create({data:{userId:user.id,studyGuideId:user.activeStudyGuideId!,disciplineId:discipline.id,subjectId:subject.id,orderIndex:i}});
 }
 const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{id:user.id,sub:user.id,name:user.name,email:user.email},maxAge:3600});
 await context.addCookies([{name:"next-auth.session-token",value:token,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax"}]);
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:390,height:844}]) {
  await page.setViewportSize(viewport);
  for(const theme of ["light","dark"]) {
   await page.addInitScript(value=>localStorage.setItem("theme",value),theme);
   for(const [name,route] of [["estudar","/registro"],["ciclo","/ciclo"]]) {
    await page.goto(route);await page.waitForLoadState("networkidle");await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await page.locator("body").evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(theme==="dark"?"rgb(12, 14, 21)":"rgb(252, 248, 255)");
    if(viewport.width>=1440) {
     const main=(await page.locator("main").boundingBox())!;expect(main.width).toBeLessThanOrEqual(1104);
     expect((await page.locator("aside").first().boundingBox())!.width).toBe(260);
     if(name==="estudar") expect(await page.locator("#study-subject").evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(36);
     else { const rows=await page.locator(".cycle-row").all();let visible=0;for(const row of rows){const box=(await row.boundingBox())!;expect(box.height).toBeLessThanOrEqual(105);if(box.y+box.height<viewport.height)visible++;}expect(visible).toBeGreaterThanOrEqual(4); }
    }
    await page.addStyleTag({content:"nextjs-portal {display:none!important}"});
    await page.screenshot({path:"artifacts/fidelity/"+name+"-"+theme+"-"+viewport.width+".png"});
   }
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto("/registro");await page.waitForLoadState("networkidle");
 await page.getByRole("button",{name:"Registrar questões",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Registre o que foi estudado"});await expect(dialog).toBeVisible();
 const body=dialog.getByTestId("finish-content");const close=dialog.getByRole("button",{name:"Fechar",exact:true});const save=dialog.getByRole("button",{name:"Salvar e concluir",exact:true});
 await expect(close).toBeInViewport();await expect(save).toBeInViewport();
 await body.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(close).toBeInViewport();await expect(save).toBeInViewport();await expect(dialog.getByRole("textbox",{name:"Observação",exact:true})).toBeInViewport();
 await page.addStyleTag({content:"nextjs-portal {display:none!important}"});await page.screenshot({path:"artifacts/fidelity/modal-mobile.png"});await close.click();
 page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Cancelar",exact:true}).click();
});


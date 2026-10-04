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
  for (const [index, item] of [["Banco de Dados", "Ferramentas Analytics"], ["Língua Inglesa", "Compreensão e gramática aplicada ao texto técnico"], ["Segurança da Informação", "Criptografia assimétrica e assinaturas digitais"], ["Redes de Computadores", "Arquitetura TCP/IP e protocolos de aplicação"]].entries()) {
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


test("Estudar: comparação na viewport da referência Stitch", async({page,context})=>{
 test.setTimeout(150000);
 const user=await fixturePrisma.user.findUniqueOrThrow({where:{id:fixtureUserId}});
 const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{id:user.id,sub:user.id,name:user.name,email:user.email},maxAge:3600});
 await context.addCookies([{name:"next-auth.session-token",value:token,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax"}]);
 const phase=process.env.MATCH_PHASE??"after";
 await page.setViewportSize({width:1018,height:814});
 const measurements:Record<string,unknown>={};
 for(const theme of ["light","dark"]){
  await page.addInitScript(t=>localStorage.setItem("theme",t),theme);await page.goto("/registro");await page.waitForLoadState("networkidle");await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:"nextjs-portal{display:none!important}"});
  measurements[theme]=await page.evaluate(()=>{
   const box=(el:Element|null)=>{if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontSize,padding:s.padding,gap:s.gap,display:s.display};};
   const subject=document.querySelector("#study-subject"),section=subject?.closest("section"),tabs=document.querySelector('[role="tablist"]');
   return {viewport:[innerWidth,innerHeight],main:box(document.querySelector("main")),heading:box(document.querySelector("main h1")),subject:box(subject),secondary:box(document.querySelector("[data-study-subtitle]")??subject?.previousElementSibling??null),workspace:box(section?.querySelector(".sf-surface")??null),tabs:box(tabs),tab:box(tabs?.firstElementChild??null),cta:box(document.querySelector('[role="tabpanel"] button')),footer:box(document.querySelector(".study-context-strip")),sidebar:box(document.querySelector("aside")),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  await page.screenshot({path:"artifacts/study-match/"+phase+"-"+theme+"-1018x814.png"});
  if(phase==="after"){
   await expect(page.locator("body > div aside").first()).toBeVisible();
   await expect(page.getByRole("tab",{name:"Questões",exact:true})).toBeVisible();
   await expect(page.getByRole("button",{name:"Registrar questões",exact:true})).toBeInViewport();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const workspace=(await page.locator("[data-study-workspace]").boundingBox())!;
   expect(workspace.width).toBeGreaterThanOrEqual(755);expect(workspace.width).toBeLessThanOrEqual(770);expect(workspace.height).toBeGreaterThanOrEqual(382);expect(workspace.height).toBeLessThanOrEqual(396);
   expect(Math.abs(workspace.y-230)).toBeLessThanOrEqual(10);
   await expect(page.getByRole("region",{name:"Progresso de hoje"})).toBeInViewport();
   await expect(page.getByRole("link",{name:"Ver sessões",exact:true})).toBeInViewport();
  }
 }
 const fs=await import("node:fs/promises");await fs.writeFile("artifacts/study-match/"+phase+"-measurements.json",JSON.stringify(measurements,null,2));
 if(phase==="after"){
  await page.setViewportSize({width:390,height:844});await page.goto("/registro");await page.waitForLoadState("networkidle");await expect(page.getByRole("tab",{name:"Cronômetro",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.addStyleTag({content:"nextjs-portal{display:none!important}"});await page.screenshot({path:"artifacts/study-match/after-mobile.png"});
 }
});

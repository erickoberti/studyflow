import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { encode } from 'next-auth/jwt';
const screens = [ ['base',1293,1600], ['registros',1524,1600], ['revisao',1600,1419], ['ciclo',1600,1525], ['dashboard',1600,1600], ['registro',1600,1280] ] as const;
test.beforeEach(async ({context})=>{
  const db=new PrismaClient();
  try {
    const user=await db.user.findFirstOrThrow({where:{activeStudyGuideId:{not:null},name:'Erick Oberti'},select:{id:true,name:true,email:true}});
    const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{id:user.id,sub:user.id,name:user.name,email:user.email},maxAge:3600});
    await context.addCookies(['next-auth.session-token','__Secure-next-auth.session-token'].map(name=>({name,value:token,domain:'localhost',path:'/',httpOnly:true,secure:name.startsWith('__Secure'),sameSite:'Lax' as const}))); 
    await context.addInitScript(()=>localStorage.setItem('theme','light'));
  } finally {await db.$disconnect();}
});
for(const [route,width,height] of screens) test(`${route}: referência e mobile`,async({page})=>{
  test.skip(Boolean(process.env.VISUAL_SCREEN) && process.env.VISUAL_SCREEN!==route);
  await page.setViewportSize({width,height});
  await page.goto('/'+route); await expect(page.locator('main h1').first()).toBeAttached();
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`artifacts/official-final/${route}-reference.png`});
  if(route==='dashboard') {
    for(const viewport of [{width:1280,height:1280},{width:1920,height:945}]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('aside').first()).toHaveCSS('width','256px');
      await expect(page.locator('main h1')).toHaveCSS('font-size','32px');
      await expect(page.locator('#next-study-title')).toHaveCSS('font-size','28px');
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.screenshot({path:`artifacts/official-final/dashboard-${viewport.width}.png`,fullPage:true});
    }
  }
  if(route==='registro') {
    for(const viewport of [{width:1280,height:1024},{width:1366,height:768},{width:1920,height:945}]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('#main-content')).toHaveCSS('max-width','1440px');
      await expect.poll(async()=>{const box=await page.locator('.study-footer').boundingBox();return box ? box.y+box.height<=viewport.height : false;}).toBe(true);
      await page.screenshot({path:`artifacts/official-final/registro-${viewport.width}.png`,fullPage:true});
    }
    for(const name of ['Cronômetro','Conteúdo','Questões']) {await page.getByRole('tab',{name,exact:true}).click(); await expect(page.getByRole('tabpanel',{name,exact:true})).toBeVisible();}
  }
  if(route==='base') {
    const cards=page.locator('article[data-tone]');
    expect(await cards.count()).toBeLessThanOrEqual(3);
    const next=page.getByRole('button',{name:'Próxima página de disciplinas'});
    if(await next.isEnabled()) {
      const first=await cards.first().locator('h2').innerText();
      await next.click();
      await expect(cards.first().locator('h2')).not.toHaveText(first);
      await expect(page.getByRole('button',{name:'Página 2 de disciplinas'})).toHaveAttribute('aria-current','page');
    }
    await page.getByPlaceholder('Filtrar tópicos ou termos...').fill('zzzznenhum');
    await expect(page.getByText('Nenhuma disciplina encontrada.')).toBeVisible();
    await page.getByPlaceholder('Filtrar tópicos ou termos...').fill('');
    await expect(page.getByRole('button',{name:'Página 1 de disciplinas'})).toHaveAttribute('aria-current','page');
    await page.getByLabel('Disciplinas por página',{exact:true}).selectOption('6');
    expect(await cards.count()).toBeLessThanOrEqual(6);
    await page.getByLabel('Disciplinas por página',{exact:true}).selectOption('3');
  }
  if(route==='registros') {
    const search=page.getByPlaceholder('Filtrar por disciplina/assunto/data');
    await search.fill('zzzznenhum'); await expect(page.getByText('Nenhum registro encontrado.')).toBeVisible(); await search.fill(''); await search.blur();
    await page.getByRole('button',{name:'Teoria',exact:true}).click();
    await expect(page.getByRole('button',{name:'Teoria',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'Todas as atividades',exact:true}).click();
    const detail=page.locator('.history-details').first();
    await detail.locator('summary').click(); await detail.getByRole('button',{name:'Editar',exact:true}).click();
    await expect(page.getByText('Editando registro',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click(); await detail.locator('summary').click();
    for(const viewport of [{width:1280,height:1344},{width:1920,height:945}]) {
      await page.setViewportSize(viewport);
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.screenshot({path:`artifacts/official-final/registros-${viewport.width}.png`,fullPage:true});
    }
  }
  await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>window.scrollTo(0,0));
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.getByRole('navigation',{name:'Navegação móvel'})).toBeVisible();
  await expect(page.locator('main table:visible')).toHaveCount(0);
  await page.screenshot({path:`artifacts/official-final/${route}-mobile.png`,fullPage:true});
  await page.screenshot({path:`artifacts/official-final/${route}-mobile-viewport.png`});
  await page.setViewportSize({width,height});
  await page.getByRole('button',{name:'Ativar modo escuro',exact:true}).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({path:`artifacts/official-final/${route}-dark.png`});
});




test('formulários e navegação preservados sem gravar dados',async({page})=>{
 test.skip(Boolean(process.env.VISUAL_SCREEN));
 await page.goto('/base?tab=disciplinas&novo=1'); await expect(page.getByRole('button',{name:'Criar disciplina',exact:true})).toBeVisible();
 await page.goto('/base?tab=assuntos&novo=1'); await expect(page.getByRole('button',{name:'Criar assunto',exact:true})).toBeVisible();
 await page.goto('/base?import=1'); await expect(page.getByRole('heading',{name:'Importar cadastro-base'})).toBeVisible();
 await page.goto('/registros'); const detail=page.locator('.history-details').first(); await detail.locator('summary').click(); await detail.getByRole('button',{name:'Editar',exact:true}).click(); await expect(page.getByText('Editando registro', {exact:true})).toBeVisible(); await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.goto('/ciclo'); await page.getByRole('link',{name:/Ver todas as posições/}).click(); await expect(page.getByRole('link',{name:/Mostrar trecho atual/})).toBeVisible(); const menu=page.locator('details').filter({has:page.locator('summary',{hasText:'Gerenciar posição #1'})}).first(); await menu.locator('summary').click(); await menu.getByRole('button',{name:'Excluir',exact:true}).click(); await expect(page.getByRole('alertdialog')).toBeVisible(); await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.goto('/revisao'); await page.getByRole('link',{name:/Concluídas recentemente/}).click(); await expect(page.getByRole('heading',{name:'Concluídas recentemente'})).toBeVisible(); await page.getByRole('link',{name:/Calendário/}).click(); await expect(page.getByRole('heading',{name:'Calendário de revisões'})).toBeVisible();
 await page.goto('/dashboard'); await page.getByRole('link',{name:'Iniciar agora',exact:true}).click(); await expect(page.getByRole('tabpanel',{name:'Cronômetro',exact:true})).toBeVisible();
 await page.goto('/registro?novo=1'); await expect(page.locator('main form').first()).toBeVisible();
});

for (const route of ['mais','metas','estatisticas','simulados','planejamento','guias','configuracoes','debug/ciclo']) test(`recursos ${route}: desktop, mobile e ações`,async({page})=>{
 test.skip(Boolean(process.env.VISUAL_SCREEN) && process.env.VISUAL_SCREEN!==route);
 const name=route.replace('/','-');
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/'+route); await expect(page.locator('main h1').first()).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`artifacts/resources-final/${name}-desktop.png`,fullPage:true});
 if(route==='mais') await expect(page.getByRole('navigation',{name:'Mais recursos',exact:true}).getByRole('link')).toHaveCount(10);
 if(route==='metas') {await page.locator('#ajustar-plano summary').click(); await expect(page.locator('#ajustar-plano input:not([type=hidden])').first()).toBeVisible(); await page.locator('#ajustar-plano summary').click();}
 if(route==='planejamento') {const search=page.getByPlaceholder('Buscar assunto'); await search.fill('zzzznenhum'); await expect(page.getByText('Nenhum assunto encontrado.')).toBeVisible(); await search.fill(''); await search.blur();}
 if(route==='configuracoes') {
   const input=page.locator('input[name=dailyQuestionsGoal]'); const previous=await input.inputValue(); await input.fill('99');
   await page.getByRole('button',{name:'Desfazer alterações',exact:true}).click(); await expect(input).toHaveValue(previous);
   await expect(page.getByRole('button',{name:'Salvar alterações',exact:true})).toBeEnabled();
 }
 if(route==='guias') {await page.getByRole('button',{name:'Novo guia',exact:true}).click(); await expect(page.getByRole('button',{name:'Criar guia',exact:true})).toBeVisible(); await page.reload();}
 if(route==='simulados') {const input=page.getByRole('spinbutton',{name:/Acertos de/}).first(); await input.fill('1'); await expect(input).toHaveValue('1'); await input.fill('0'); await input.blur();}
 if(route==='estatisticas') await expect(page.getByRole('link',{name:'Exportar Dados',exact:true})).toHaveAttribute('href','/api/export/csv');
 await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>window.scrollTo(0,0));
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.getByRole('navigation',{name:'Navegação móvel'})).toBeVisible();
 await page.screenshot({path:`artifacts/resources-final/${name}-mobile.png`,fullPage:true});
 await page.screenshot({path:`artifacts/resources-final/${name}-mobile-viewport.png`});
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Ativar modo escuro',exact:true}).first().click(); await expect(page.locator('html')).toHaveClass(/dark/);
 await page.screenshot({path:`artifacts/resources-final/${name}-dark.png`,fullPage:true});
});

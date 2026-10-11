import {chromium} from 'playwright';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
const out=process.env.SHOT_DIR||'/downloads';
const server=spawn('node',['--import','tsx','server/index.ts'],{stdio:'ignore',env:{...process.env,NODE_ENV:'development',DB_PATH:':memory:',PUBLIC_URL:'http://127.0.0.1:3001'}});let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3001/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();
 await page.goto('http://127.0.0.1:3001');await page.getByText('Your household is ready.',{exact:false}).waitFor();
 // 1. baseline plan and approval
 await page.getByRole('button',{name:'Plan the day as it is'}).click();await page.getByRole('button',{name:/Finish earlier/}).waitFor();
 await page.getByRole('button',{name:/Finish earlier/}).click();await page.getByRole('button',{name:'Review and approve'}).click();await page.getByRole('button',{name:'Confirm and save'}).click();
 await page.getByText('Approved plan',{exact:true}).waitFor();console.log('PASS baseline plan approved');
 // 2. natural-language change: preview then apply
 await page.getByRole('textbox').fill("Maya's call moved to 4pm");await page.getByRole('button',{name:'Review request'}).click();
 await page.getByText('Understood',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Review and approve'}).count(),0);
 await page.locator('summary').click();
 await page.getByRole('button',{name:'Apply this change and plan'}).click();await page.getByRole('button',{name:/Smallest change/}).waitFor();
 assert.ok((await page.getByRole('button',{name:/Smallest change/}).getAttribute('aria-pressed'))==='true');
 assert.ok(await page.getByText('MOVED',{exact:true}).count()>0);console.log('PASS preview, apply, smallest-change plan and reason trace');
 await page.addStyleTag({content:'.approval{position:static!important}.sidebar{position:static!important;height:auto!important}'});await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});await page.screenshot({path:out+'/qw-built-desktop.png',fullPage:true});
 // mobile
 const m=await (await browser.newContext({viewport:{width:390,height:860},isMobile:true})).newPage();
 await m.goto('http://127.0.0.1:3001');await m.getByText('Your household is ready.',{exact:false}).waitFor();
 await m.getByRole('button',{name:'Plan the day as it is'}).click();await m.getByRole('button',{name:/Finish earlier/}).click();await m.getByRole('button',{name:'Review and approve'}).click();await m.getByRole('button',{name:'Confirm and save'}).click();await m.getByText('Approved plan',{exact:true}).waitFor();
 await m.getByRole('textbox').fill("Maya's call moved to 4pm");await m.getByRole('button',{name:'Review request'}).click();await m.getByRole('button',{name:'Apply this change and plan'}).click();await m.getByRole('button',{name:/Smallest change/}).waitFor();
 assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'mobile horizontal overflow');console.log('PASS mobile has no page-level horizontal overflow');
 await m.addStyleTag({content:'.approval{position:static!important}.sidebar{position:static!important;height:auto!important}'});await m.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});await m.screenshot({path:out+'/qw-built-mobile.png',fullPage:true});
 // 3. negotiation when a chore cannot fit
 await page.getByRole('button',{name:'Reset fictional demo'}).click();await page.getByText('Fictional household reset.').waitFor();
 await page.getByRole('button',{name:'Plan the day as it is'}).click();await page.getByRole('button',{name:/Finish earlier/}).click();await page.getByRole('button',{name:'Review and approve'}).click();await page.getByRole('button',{name:'Confirm and save'}).click();await page.getByText('Approved plan',{exact:true}).waitFor();
 await page.getByRole('textbox').fill("Maya's call now 15:00 to 17:30");await page.getByRole('button',{name:'Review request'}).click();await page.getByRole('button',{name:'Apply this change and plan'}).click();
 await page.getByText('Decision needed',{exact:false}).waitFor();await page.getByText('Skip it today',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Review and approve'}).click();assert.equal(await page.getByRole('button',{name:'Confirm and save'}).isDisabled(),true);console.log('PASS unplaced chore needs negotiation and second confirmation');
 await page.addStyleTag({content:'.approval{position:static!important}.sidebar{position:static!important;height:auto!important}'});await page.screenshot({path:out+'/qw-built-negotiation.png',fullPage:true});
 // 4. reload keeps state
 await page.reload();await page.getByText('Household revision',{exact:false}).waitFor();console.log('PASS reload keeps session');
}finally{if(browser)await browser.close();server.kill()}

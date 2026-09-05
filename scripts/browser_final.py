from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1440,"height":900},device_scale_factor=1)
    errors=[];external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if not r.url.startswith(('http://127.0.0.1:4173','data:','blob:')) else None)
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_selector('#start',timeout=90000)
    page.locator('#music').uncheck()
    print('ASSETS',page.evaluate('({sprites:Object.keys(ra2.assets.manifest.sprites).length,terrain:Object.keys(ra2.assets.terrain).length,scenery:Object.keys(ra2.assets.scenery).length,failures:ra2.assets.failures})'))
    page.screenshot(path='/tmp/ra2-final-lobby.png')
    page.locator('select[aria-label="玩家 1 国家"]').select_option('iraq')
    page.locator('#choose-map').click();page.locator('[data-map-id="mp20mw"]').click();page.wait_for_function("!document.querySelector('#map-confirm').disabled");page.locator('#map-confirm').click()
    page.locator('#fog').uncheck();page.locator('#speed').select_option('2');page.locator('#start').click();page.wait_for_selector('#battlefield-canvas');page.keyboard.press('d');page.wait_for_timeout(300)
    print('SOVIET_DEPLOY',page.evaluate('ra2.game.entities.filter(e=>e.owner===0).map(e=>e.type)'))
    print('NEUTRALS',page.evaluate('ra2.game.entities.filter(e=>e.owner===-1).length'))
    # Create one test engineer beside a real native oil derrick, then perform selection and capture through the real UI.
    setup=page.evaluate('''()=>{const g=ra2.game,r=ra2.renderer;g.players.slice(1).forEach(p=>{p.aiTimer=10000;p.aiAttackTimer=10000});const oil=g.entities.find(e=>e.type==='neutral_caoild');let pos;for(let dx=-4;dx<=4&&!pos;dx++)for(let dy=-4;dy<=4&&!pos;dy++){const x=Math.floor(oil.x)+dx,y=Math.floor(oil.y)+dy,t=g.map.cells[y*g.map.width+x];if(['land','snow','road','ore','gem'].includes(t)&&Math.hypot(dx,dy)>3)pos={x:x+.5,y:y+.5};}const e=g.spawnEntity('soviet_engineer',0,pos.x,pos.y);r.center((e.x+oil.x)/2,(e.y+oil.y)/2);return {engineer:e.id,oil:oil.id,credits:g.players[0].credits};}''')
    page.wait_for_timeout(300)
    coords=page.evaluate('''(s)=>{const r=ra2.renderer,g=ra2.game,e=g.getEntity(s.engineer),o=g.getEntity(s.oil);return {e:r.toScreen(e.x,e.y),o:r.toScreen(o.x,o.y)}}''',setup)
    b=page.locator('#battlefield-canvas').bounding_box();page.mouse.click(b['x']+coords['e']['x'],b['y']+coords['e']['y']-7);page.mouse.click(b['x']+coords['o']['x'],b['y']+coords['o']['y']-15,button='right')
    page.wait_for_function('(id)=>ra2.game.getEntity(id).owner===0',arg=setup['oil'],timeout=20000)
    print('CAPTURE',page.evaluate('(s)=>({owner:ra2.game.getEntity(s.oil).owner,credits:ra2.game.players[0].credits,delta:ra2.game.players[0].credits-s.credits})',setup))
    page.screenshot(path='/tmp/ra2-oil-capture.png')
    # The normal end-condition is covered headlessly; use surrender to verify UI result dismissal with Escape.
    page.locator('#game-options').click();page.locator('#surrender').click();page.wait_for_selector('.result-subtitle');page.keyboard.press('Escape');page.wait_for_selector('#start')
    # Compact laptop and narrow view layouts stay usable.
    page.set_viewport_size({'width':1024,'height':768});page.screenshot(path='/tmp/ra2-laptop.png');assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
    page.set_viewport_size({'width':760,'height':900});page.screenshot(path='/tmp/ra2-narrow.png',full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
    print('EXTERNAL_REQUESTS',external);print('ERRORS',errors);assert not errors;assert not external
    browser.close()

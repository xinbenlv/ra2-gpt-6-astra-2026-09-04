from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1440,"height":960},device_scale_factor=1)
    errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_selector('#start',timeout=90000)
    page.locator('#choose-map').click(); page.locator('#map-search').fill('雪谷');page.wait_for_timeout(100)
    print('MAP_SEARCH',page.locator('#map-list').inner_text())
    page.locator('#map-cancel').click()
    page.locator('#credits').select_option('50000');page.locator('#fog').uncheck();page.locator('#speed').select_option('2')
    page.locator('#start').click();page.wait_for_selector('#battlefield-canvas');page.keyboard.press('d');page.wait_for_timeout(200)
    page.evaluate('ra2.game.players.slice(1).forEach(p=>{p.aiTimer=10000;p.aiAttackTimer=10000})')
    def wait_build(typeid):
        page.locator(f'[data-build="{typeid}"]').click()
        page.wait_for_function('(id)=>ra2.game.players[0].queues[Object.keys(ra2.game.players[0].queues).find(k=>ra2.game.players[0].queues[k].some(q=>q.type===id))]?.some(q=>q.type===id&&q.ready)',arg=typeid,timeout=45000)
        page.wait_for_timeout(250)
        page.locator(f'[data-build="{typeid}"]').click()
        # Discover legal placement using the engine, then click the real canvas at its projected coordinates.
        point=page.evaluate('''(type)=>{const r=ra2.renderer,g=ra2.game,b=g.entities.find(e=>e.owner===0&&e.type==='construction_yard');for(let radius=4;radius<15;radius++)for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){const x=b.x+dx,y=b.y+dy,p=r.toScreen(x,y);if(g.canPlace(0,type,x,y)&&p.x>80&&p.x<r.width-80&&p.y>80&&p.y<r.height-120)return {x,y,sx:p.x,sy:p.y};}return null}''',typeid)
        assert point is not None,typeid+' no position'
        bounds=page.locator('#battlefield-canvas').bounding_box()
        page.mouse.move(bounds['x']+point['sx'],bounds['y']+point['sy']);page.wait_for_timeout(150);page.mouse.click(bounds['x']+point['sx'],bounds['y']+point['sy'])
        page.wait_for_function('(id)=>ra2.game.entities.some(e=>e.owner===0&&e.type===id)',arg=typeid)
        print('PLACED',typeid,point)
    wait_build('power_plant');wait_build('refinery');wait_build('barracks');wait_build('war_factory')
    page.locator('[data-category="infantry"]').click();page.locator('[data-build="gi"]').click();page.locator('[data-build="gi"]').click();page.wait_for_timeout(4000)
    page.locator('[data-category="vehicle"]').click();page.locator('[data-build="grizzly"]').click();page.wait_for_timeout(4000)
    print('PRODUCED',page.evaluate('({units:ra2.game.players[0].unitsBuilt,money:ra2.game.players[0].credits,buildings:ra2.game.players[0].buildingsBuilt,entities:ra2.game.entities.filter(e=>e.owner===0).map(e=>({type:e.type,order:e.order.kind}))})'))
    # Select a tank with actual mouse, then issue move command and verify displacement.
    tank=page.evaluate('''()=>{const e=ra2.game.entities.find(e=>e.owner===0&&e.type==='grizzly');const p=ra2.renderer.toScreen(e.x,e.y);return {id:e.id,x:e.x,y:e.y,sx:p.x,sy:p.y}}''')
    b=page.locator('#battlefield-canvas').bounding_box();page.mouse.click(b['x']+tank['sx'],b['y']+tank['sy']-5)
    dest=page.evaluate('''(id)=>{const e=ra2.game.entities.find(e=>e.id===id);return ra2.renderer.toScreen(e.x+3,e.y+3)}''',tank['id'])
    page.mouse.click(b['x']+dest['x'],b['y']+dest['y'],button='right');page.wait_for_timeout(2000)
    moved=page.evaluate('(id)=>{const e=ra2.game.entities.find(e=>e.id===id);return {x:e.x,y:e.y,order:e.order.kind}}',tank['id']);print('MOVEMENT',tank,moved)
    assert abs(moved['x']-tank['x'])+abs(moved['y']-tank['y'])>0.5
    page.keyboard.press('h');page.screenshot(path='/tmp/ra2-established-base.png')
    page.locator('#game-options').click();t=page.evaluate('ra2.game.time');page.wait_for_timeout(500);assert page.evaluate('ra2.game.time')==t
    page.locator('#surrender').click();page.wait_for_selector('#result-back');print('DEFEAT',page.locator('.result-subtitle').inner_text());page.screenshot(path='/tmp/ra2-result.png')
    page.locator('#result-back').click();page.wait_for_selector('#start');print('ERRORS',json.dumps(errors));assert not errors
    browser.close()

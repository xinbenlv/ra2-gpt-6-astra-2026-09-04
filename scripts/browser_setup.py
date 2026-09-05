"""Real browser acceptance: explicit consent, IA download, local conversion, offline reuse."""
from playwright.sync_api import sync_playwright
import json, time, os
URL=os.environ.get('RA2_BROWSER_URL','http://127.0.0.1:4174')
PROFILE=os.environ.get('RA2_BROWSER_PROFILE','.cache/browser-acceptance')
with sync_playwright() as p:
    context=p.chromium.launch_persistent_context(PROFILE,headless=True,viewport={'width':1440,'height':1000})
    page=context.pages[0] if context.pages else context.new_page()
    requests=[];errors=[];console=[]
    page.on('request',lambda request:requests.append(request.url))
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda msg:console.append(msg.text))
    page.goto(URL,wait_until='networkidle')
    page.wait_for_selector('#setup-download, #start',timeout=30000)
    if page.locator('#setup-download').count():
        assert not any('archive.org' in url for url in requests), 'Originals downloaded before consent'
        assert page.locator('#setup-download').inner_text()=='Agree & download'
        page.screenshot(path='.cache/browser-consent.png')
        page.locator('#setup-download').click()
        last=''
        for i in range(1200):
            if page.locator('#start').count():break
            status=page.locator('#setup-status').inner_text() if page.locator('#setup-status').count() else 'Starting game'
            if status!=last:print('STATUS',status,flush=True);last=status
            if page.locator('#setup-error').count() and page.locator('#setup-error').is_visible():
                print('CONSOLE',json.dumps(console[-20:]),flush=True)
                raise AssertionError(page.locator('#setup-error').inner_text())
            page.wait_for_timeout(1000)
        page.wait_for_selector('#start',timeout=30000)
        assert any('cors.archive.org/cors/' in url for url in requests), 'No browser-direct IA request'
    print('READY',page.evaluate('({sprites:Object.keys(ra2.assets.manifest.sprites).length,maps:ra2.maps?.length,failures:ra2.assets.failures})'),flush=True)
    page.screenshot(path='.cache/browser-ready.png')
    before=len([r for r in requests if 'archive.org' in r]);page.reload(wait_until='networkidle');page.wait_for_selector('#start',timeout=90000)
    assert len([r for r in requests if 'archive.org' in r])==before,'Re-downloaded on repeat visit'
    context.set_offline(True);page.reload(wait_until='networkidle');page.wait_for_selector('#start',timeout=90000)
    page.locator('#start').click();page.wait_for_selector('#battlefield-canvas');page.keyboard.press('d');page.wait_for_timeout(1000)
    print('OFFLINE_GAME',page.evaluate('ra2.game.entities.filter(e=>e.owner===0).map(e=>e.type)'),flush=True)
    page.screenshot(path='.cache/browser-offline-game.png')
    print('ERRORS',errors,flush=True);assert not errors
    context.close()

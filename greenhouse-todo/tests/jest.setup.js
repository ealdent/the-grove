// Minimal DOM fixture mirroring index.html. app.js wires up its listeners at
// module scope, so every element it looks up has to exist here or importing it
// throws before a single test runs.
document.body.innerHTML = `
    <div id="crosshair"></div>
    <div id="hover-tooltip"></div>
    <div id="blocker">
        <div id="instructions"></div>
    </div>
    <div id="ui-container"></div>

    <div id="add-todo-modal" class="gh-scrim">
        <div class="gh-panel">
            <div class="gh-panel-inner">
                <form id="add-todo-form" novalidate>
                    <span id="title-count"></span>
                    <input type="text" id="todo-title">
                    <p id="title-error"></p>
                    <span id="desc-count"></span>
                    <textarea id="todo-desc"></textarea>
                    <div role="radiogroup">
                        <label><input type="radio" name="urgency" value="1"></label>
                        <label><input type="radio" name="urgency" value="2" checked></label>
                        <label><input type="radio" name="urgency" value="3"></label>
                    </div>
                    <button type="button" id="close-add-modal"></button>
                    <button type="submit" id="btn-plant"></button>
                </form>
            </div>
        </div>
    </div>

    <div id="todo-modal" class="gh-scrim">
        <div class="gh-panel">
            <div class="gh-panel-inner">
                <span id="modal-urgency"></span>
                <span id="modal-tended"></span>
                <h2 id="modal-title"></h2>
                <p id="modal-desc"></p>
                <span id="vitals-label"></span>
                <strong id="modal-health-label"></strong>
                <span id="modal-health"></span>
                <div id="modal-meter" role="meter">
                    <div id="modal-meter-fill"></div>
                    <div id="modal-meter-ghost"></div>
                </div>
                <p id="modal-decay"></p>
                <div id="status-chips">
                    <button type="button" class="gh-chip" data-status="Not Started"></button>
                    <button type="button" class="gh-chip" data-status="Procrastinating"></button>
                    <button type="button" class="gh-chip" data-status="In Progress"></button>
                    <button type="button" class="gh-chip" data-status="Almost Done"></button>
                </div>
                <div role="radiogroup">
                    <label><input type="radio" name="effort" value="0" checked></label>
                    <label><input type="radio" name="effort" value="30"></label>
                    <label><input type="radio" name="effort" value="60"></label>
                    <label><input type="radio" name="effort" value="100"></label>
                </div>
                <button type="button" id="btn-checkin"><span id="checkin-preview"></span></button>
                <button type="button" id="close-modal"></button>
                <button type="button" id="btn-complete"></button>
            </div>
        </div>
    </div>

    <div id="gh-toast" role="status" aria-live="polite"></div>

    <div id="mobile-controls">
        <div id="look-zone"></div>
        <div id="joystick"><div id="stick"></div></div>
        <button id="mobile-menu-btn"></button>
    </div>
`;

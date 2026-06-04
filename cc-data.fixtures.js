const TASK_TEXT = `<page url="https://app.notion.com/p/37478f3d415b810fb6bbddc7cba78f30">
<properties>
{"Area":"Focus & Work","Done":"__NO__","Notes":"Need to inform Donna when she returns from Mainland.","Priority":"__NO__","Task":"McCleary Estate Return (Husband)","date:Created:is_datetime":0,"date:Created:start":"2026-05-30","date:Due Date:is_datetime":0,"date:Due Date:start":"2026-10-05","url":"https://app.notion.com/p/37478f3d415b810fb6bbddc7cba78f30"}
</properties>
<blank-page>This page is blank and has no content.</blank-page>
</page>`;
const TASK_OBJ = { metadata:{type:"page"}, title:"McCleary Estate Return (Husband)", url:"x", text: TASK_TEXT };
const TASK_STRING = JSON.stringify(TASK_OBJ);
const TASK_CONTENT = { content:[{ type:"text", text: TASK_OBJ.text }] };
const STATE_TEXT = 'State store. Do not edit by hand.\n```json\n{"schemaVersion":"2.0.0","appVersion":"1.2.0","streak":12,"lastCompleted":"2026-06-03","taskIds":["a","b"],"wins":[],"databases":{"tasks":"fb432308-59b9-4078-92db-a83c6279957d"}}\n```\n';
module.exports = { TASK_TEXT, TASK_OBJ, TASK_STRING, TASK_CONTENT, STATE_TEXT };

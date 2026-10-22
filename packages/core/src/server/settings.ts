import "server-only";
import { readSettingsRecord,persistSettings,SettingsLogoError,SettingsIconError } from "@sohoin/database";
import { resolveSettings,settingsPatchSchema,updateSettingsSchema,type SettingsPatch } from "@sohoin/extension-api/settings";
import { requireAdministrator,enforceLimit,ServiceError } from "./security";
export function createSettingsService(defaults:SettingsPatch={}) {
  async function readStored() {
    const record=await readSettingsRecord();
    return {settings:resolveSettings(settingsPatchSchema.parse(record.value),defaults),revision:record.revision};
  }
  return {
    async readPublic() {const snapshot=await readStored();return {...snapshot,settings:{...snapshot.settings,logo:{normal:snapshot.settings.logo.normal?"/api/v1/site-logo/normal":null,dark:snapshot.settings.logo.dark?"/api/v1/site-logo/dark":null},icons:{favicon:snapshot.settings.icons.favicon?"/api/v1/site-icon/favicon":null,app:snapshot.settings.icons.app?"/api/v1/site-icon/app-512":null}}};},
    async readAdmin(headers:Headers) {await requireAdministrator(headers);return readStored();},
    async update(headers:Headers,input:unknown) {
      const actor=await requireAdministrator(headers);
      await enforceLimit("settings-write",actor.id,30,60);
      const parsed=updateSettingsSchema.safeParse(input);
      if(!parsed.success)throw new ServiceError(400,"VALIDATION_ERROR",parsed.error.issues[0]?.message??"设置格式不正确");
      const result=await persistSettings(parsed.data.patch,parsed.data.revision,actor.id).catch(error=>{if(error instanceof SettingsIconError)throw new ServiceError(400,"INVALID_SITE_ICON",error.message);if(error instanceof SettingsLogoError)throw new ServiceError(400,"INVALID_LOGO",error.message);throw error;});
      if(!result)throw new ServiceError(409,"REVISION_CONFLICT","设置已被其他人修改，请重新加载后再保存");
      return {settings:resolveSettings(settingsPatchSchema.parse(result.value),defaults),revision:result.revision};
    },
  };
}

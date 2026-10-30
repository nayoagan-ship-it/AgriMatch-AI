export const PROVINCES=['北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省','重庆市','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区','台湾省','香港特别行政区','澳门特别行政区'];
export const PROVINCE_SOURCE='https://www.locpg.gov.cn/2022-06/07/c_1211652713.htm';
export function policyOriginCode(province){return ({'香港特别行政区':'HK','澳门特别行政区':'MO','台湾省':'TW'})[province]||'CN';}
export function originSearchName(province){return ({'香港特别行政区':'Hong Kong','澳门特别行政区':'Macao','台湾省':'Taiwan'})[province]||'China';}

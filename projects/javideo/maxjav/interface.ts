/**
 * 对应表结构: __REF__keyword_video_list
 */
export interface __REF__KEYWORD_VIDEO_LIST {
  video_code: string;
  keyword?: string;
  update_timestamp: number;
}
/**
 * 对应表结构: __REF__keyword_not_include
 */
export interface __REF__KEYWORD_NOT_INCLUDE {
  keyword: string;
  text: string;
}
/**
 * 对应表结构: __REF__video_info
 */
export interface __REF__VIDEO_INFO {
  video_code: string;
  html?: any;
  html_update_date?: string;
  desc?: string;
  title?: string;
  img_url?: string;
  img_file?: any;
  img_status?: string;
}
/**
 * 对应表结构: __REF__video_file
 */
export interface __REF__VIDEO_FILE {
  video_code: string;
  url: string;
}
/**
 * 对应表结构: keyword
 */
export interface KEYWORD {
  text: string;
  type?: string;
  idx?: number
  update_timestamp: number;
}
/**
 * 对应表结构: video_page
 */
export interface VIDEO_PAGE {
  url: string;
  item_html: string;
  code: string;
  page_update_date: string;
  update_timestamp: number;
}
/**
 * 对应表结构: download_file
 */
export interface DOWNLOAD_FILE {
  type: string;
  code_dir: string;
  keyword_dir: string;
}
export type StructDef = {
   __REF__keyword_video_list:__REF__KEYWORD_VIDEO_LIST;
   __REF__keyword_not_include:__REF__KEYWORD_NOT_INCLUDE;
   __REF__video_info:__REF__VIDEO_INFO;
   __REF__video_file:__REF__VIDEO_FILE;
   keyword:KEYWORD;
   video_page:VIDEO_PAGE;
   download_file:DOWNLOAD_FILE;
}
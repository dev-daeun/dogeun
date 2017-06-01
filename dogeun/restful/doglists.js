/**
 * @api {get} /doglists/emergency 분양이 가장 시급한 강아지 글 상위 6개
 * @apiName 메인화면 가로에 들어갈 글 6개
 * @apiGroup doglists
 *
 *
 * @apiSuccess {Number} parcel_id 분양글 id.
 * @apiSuccess {String} title  분양글 제목.
 * @apiSuccess {String} pet_thumbnail 썸네일 이미지 url
 * @apiSuceess {String} username 작성자이름
 * @apiSuccess {Number} favorite 현재 사용자의 분양글 wish 여부 
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 * {
 *   "parcel_id": 1,
 *   "title": "강아지 분양합니다",
 *   "pet_thumbnail": "http://dkfkd",
 *   "username": "user1",
 *   "favorite": null
 * }
 *
 * @apiError UserNotFound The id of the User was not found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "fail: fail원인"
 *     }
 */
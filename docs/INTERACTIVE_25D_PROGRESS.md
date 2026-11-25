# Nhat ky phat trien sa ban 2.5D tuong tac

## Muc tieu

Bien sa ban 2.5D tu phan minh hoa thu dong thanh trai nghiem co dieu khien, trong do hanh dong cua hoc sinh duoc ghi nhan, doi chieu voi tinh huong va cham diem tren may chu. Cong viec duoc phat trien, thu nghiem va luu du lieu rieng tren may local truoc khi xem xet dua len moi truong online.

Muc tieu pham vi day du la 163 tinh huong hien co, gom 14 nhom canh:

1. Cong truong hoc.
2. Nguoi di bo qua duong.
3. Giao lo va tin hieu.
4. Diem mu xe lon.
5. Mo cua xe.
6. Tram xe buyt.
7. Duong tron truot.
8. Tam nhin han che.
9. Chuong ngai vat va cong trinh.
10. Duong hep.
11. Vong xuyen.
12. Chuyen lan va nhap lan.
13. Duong sat giao cat.
14. Xe uu tien.

## Kien truc hien tai

- `components/world-3d.tsx` quan ly vong lap mo phong, vi tri, toc do, huong lai, trang thai phanh, xi-nhan, nhuong duong, khoang cach den nguy hiem va ket qua ket thuc canh.
- `components/interaction-controls.tsx` va `components/interaction-controls.module.css` cung cap dieu khien ban phim, chuot va cam ung.
- `lib/gameplay/interaction.ts` anh xa dau vet hanh dong va ket qua ket thuc vao phuong an that cua tung tinh huong theo ngu nghia, khong dua vao thu tu dap an.
- `components/api.ts` tao `attempt_id`, dong goi telemetry va gui ket qua lua chon.
- `lib/validation/input.ts` kiem tra schema, loai su kien, thu tu, moc thoi gian va payload.
- `lib/api/services.ts` rang buoc telemetry voi phien, luot choi, chang hoc va tinh huong; may chu tu tinh thoi gian phan ung va doi chieu ket qua.
- `app/page.tsx` giu giao dien cu khi tinh nang tat, va bat dieu khien sa ban khi feature flag va loai canh phu hop.

## Cach ly du lieu local

- Kho du lieu tuong tac local: `.runtime/interactive-25d/logical_store.json`.
- Toan bo `.runtime/` duoc bo qua boi Git.
- Lenh chuan bi: `npm run data:prepare:interactive`.
- Lenh chay: `npm run dev:interactive`.
- Trinh khoi dong chi chap nhan kho nam duoi `.runtime/<run>/logical_store.json`.
- Khi dung `--existing`, snapshot phai duoc danh dau `synthetic: true` va `research_evidence: false`.
- Che do acceptance buoc su dung local mock, xoa gia tri credential Google/Drive/Sheets/Gemini khoi tien trinh con va khong ghi vao Google Sheets.
- Du lieu hoc sinh va cac gia tri nghien cuu hien tai khong bi thay the boi qua trinh thu nghiem tuong tac.

## Feature flag

- Bien: `NEXT_PUBLIC_INTERACTIVE_25D`.
- Gia tri mac dinh: tat.
- `npm run dev:interactive` bat flag trong tien trinh local acceptance.
- Khi flag tat, luong dap an chu va hanh vi cu tiep tuc hoat dong.
- Khi flag bat, ung dung chi nen kich hoat runtime cho nhung nhom canh da co hop dong tuong tac va quy tac ket thuc duoc kiem thu.

## Telemetry

### Schema v1

- Duoc giu de tuong thich voi luong dap an chu hien tai.
- Moc phan ung duoc suy ra tu thoi gian tuyet doi cua `HAZARD_VISIBLE` va `DECISION_INPUT`.
- Khong duoc yeu cau co trang thai chuyen dong chi tiet.

### Schema v2

- Moi su kien phai mang cung `attempt_id`, `phase`, `scenario_id` va `at_ms` tuong doi.
- `at_ms` phai tang dan trong mot batch.
- Mot luot hop le phai co dung mot `SCENARIO_START`, mot `TERMINAL` va mot `SCENARIO_END`.
- Dau vet co the luu toc do, khoang cach den nguy hiem, hanh dong phanh/dung/nhuong, huong xi-nhan va ket qua ket thuc.
- Thoi gian phan ung duoc tinh tu luc nguy hiem xuat hien den hanh dong lien quan dau tien, khong tinh den luc bam nut xac nhan.
- May chu phai doi chieu phuong an da chon voi ket qua sa ban va tu choi khi sai luot, sai chang, sai tinh huong, thieu vong doi hoac khong khop ket qua.
- Yeu cau an toan con lai truoc khi dong pham vi: loi gui telemetry v2 khong duoc bi bo qua de tiep tuc nop ket qua theo duong fallback; khong duoc dung su kien cua luot truoc neu `attempt_id` hien tai khong co dau vet hop le.

## Trang thai ho tro canh

### Runtime day du

- API cong khai cap hop dong tuong tac cho 160 tinh huong `SCN-*`, phan bo tren 14 nhom canh dang co du lieu.
- Moi tinh huong co it nhat mot duong xu ly an toan va mot duong khong an toan.
- Anh xa hanh dong ho tro dung/phanh, nhuong, xi-nhan, di tiep/tang toc va tranh huong; khong dua vao thu tu phuong an.
- Runtime tao ket qua ket thuc tu thao tac that, sau do client va may chu cung doi chieu lai dau vet voi hop dong cua dung tinh huong.
- Van giu phuong an chu ho tro cho thiet bi hoac nguoi dung khong the dieu khien sa ban.

## Cong kiem tra bat buoc

1. `git diff --check` khong co loi khoang trang.
2. `npm run typecheck` dat.
3. `npm test` dat toan bo.
4. `npm run build` dat.
5. Kiem tra bao mat: khong lo secret, khong ghi Google Sheets trong local acceptance, telemetry v2 fail closed.
6. Browser QA tren desktop, tablet va mobile.
7. Kiem tra bang ban phim, chuot/cam ung, blur cua so va chuyen tab.
8. Thu cac ket qua dung an toan, nhuong an toan, xung dot va diem mu.
9. Xac minh du lieu chi thay doi trong kho `.runtime/interactive-25d/`.
10. Review diff va commit tren nhanh tinh nang sau khi moi cong dat.

## Ket qua kiem tra

Trang thai truoc lan kiem tra cuoi:

- Audit hop dong: 160/160 tinh huong, 14/14 nhom canh.
- Ket qua typecheck cuoi: `PASS`.
- Ket qua test cuoi: `PASS` (66/66 truoc build cuoi).
- Ket qua build cuoi: `PASS`; chi con canh bao Turbopack da biet trong `lib/google/admin-storage.ts`.
- Browser QA: `PASS` cho trang chu, dashboard 1.017 hoc sinh, luong choi thu, canvas, dieu khien, phanh, mo nut xac nhan va may chu chap nhan ket qua local.
- Telemetry audit: `PASS` cho rang buoc attempt/phase/scenario, vong doi, moc thoi gian va fail-closed.
- Ket qua audit bao mat/diff cuoi: `PASS`.

Canh bao build da biet: Turbopack co the canh bao ve truy vet filesystem dong trong `lib/google/admin-storage.ts`. Day la canh bao ton tai tu truoc, khong phai bang chung build that bai; van can ghi nhan neu xuat hien trong lan build cuoi.

## Lich su cong viec

- Hoan thanh dashboard trang chu doc tong so hoc sinh va phan bo khoi lop, commit rieng tren `main`.
- Tao nhanh `feature/interactive-25d-local` de phat trien tuong tac tach khoi dashboard.
- Them dieu khien WASD/phim mui ten, Space, Q/E, Y va dieu khien cam ung.
- Them trang thai toc do, huong lai, phanh, xi-nhan, nhuong, nguy hiem va ket thuc canh.
- Them feature flag va lenh chay local rieng tren cong 3002.
- Them kho acceptance rieng, khong ket noi nha cung cap online.
- Them anh xa ket qua theo ngu nghia cho 14 nhom canh cong khai.
- Them telemetry schema v2 va kiem tra phia may chu; tiep tuc gia co rang buoc dung luot choi va fail-closed.
- Them test cho hop dong tuong tac, anh xa ket qua thi diem va bat dong giua telemetry voi dap an.
- Tao tai lieu nay de luu vet kien truc, cong kiem tra, gioi han va ket qua cuoi.

## Dieu kien commit va tat may

Chi commit phan tuong tac khi tat ca cong kiem tra cuoi cung dat, browser QA khong con blocker, diff da duoc audit va tai lieu nay da cap nhat ket qua that. Chi tat may sau khi commit thanh cong va xac minh `git status` khong con thay doi thuoc pham vi cong viec chua duoc luu.

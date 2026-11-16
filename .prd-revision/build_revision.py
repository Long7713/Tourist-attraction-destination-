from pathlib import Path
import ast,re,copy
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from PIL import Image,ImageDraw,ImageFont

OUT=Path('PRD_Web_DaSua');OUT.mkdir(exist_ok=True)
src=Document('PRD_Web_HoanChinh/PRD_Web_HoanChinh.docx')
reference=Document('.prd-revision/reference.docx')
tree=ast.parse(Path('revise_prd.py').read_text(encoding='utf-8'))
parts={}
replacements=[]
for n in tree.body:
    if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['uc_code','data']:
        parts[n.targets[0].id]=ast.literal_eval(n.value)
    if isinstance(n,ast.Assign) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and n.value.func.attr=='replace':
        try:
            a,b=map(ast.literal_eval,n.value.args[:2])
            if isinstance(a,str) and isinstance(b,str): replacements.append((a,b))
        except:pass
def clean(t):
    if t=='Lượt truy cập có mã QR hợp lệ; không khẳng định là một lần camera quét mới.':
        return 'Lượt vào từ QR theo yêu cầu sản phẩm. Ảnh CSDL chưa có nguồn QR để tách chỉ số này; xem G02.'
    for a,b in replacements:
        if not any(s in a for s in ['d.styles','OUT=','sec.','t=','font','new(','for name','width=','diagram(']):t=t.replace(a,b)
    return t.replace('định hướng phát triển sản phẩm cập','định hướng phát triển sản phẩm').replace('Mục 9–10 quy định nghiệp vụ, chất lượng và nghiệm thu.','Mục 9–11 quy định nghiệp vụ, chất lượng và nghiệm thu.')

stories=[];current=None
for pp in src.paragraphs:
    text=pp.text
    if re.match(r'UC\d\d ',text) and len(text)<100:
        if current:stories.append(current)
        uc,title=text.split(' ',1);current=[uc,title,'US'+uc[2:],'','',[]]
    elif current:
        if text.startswith('Là '):current[3]=text
        elif text.startswith('Luồng chính: '):current[4]=text.removeprefix('Luồng chính: ')
        elif re.match(r'US\d\d AC',text):current[5].append(re.sub(r'^US\d\d AC\d+\s*','',text))
        elif text.startswith('5 Sơ đồ'):
            stories.append(current);current=None;break
assert len(stories)==13,len(stories)
d=Document('.prd-revision/reference.docx')
for el in list(d._element.body):
    if el.tag!=qn('w:sectPr'):d._element.body.remove(el)
sec=d.sections[0];sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.left_margin=Cm(2.5);sec.right_margin=Cm(2);sec.top_margin=Cm(1.7);sec.bottom_margin=Cm(1.7)
for st in d.styles:
    for border in list(st.element.iter(qn('w:pBdr'))):border.getparent().remove(border)
for name,size in [('Normal',11),('Title',22),('Heading 1',16),('Heading 2',12),('Heading 3',11)]:
    d.styles[name].font.name='Times New Roman';d.styles[name].font.size=Pt(size);d.styles[name].font.color.rgb=RGBColor(0,0,0)
d.styles['Normal'].paragraph_format.space_after=Pt(5);d.styles['Normal'].paragraph_format.line_spacing=1.05
for ar in [sec.header,sec.footer]:
    for el in list(ar._element):ar._element.remove(el)
    ar.add_paragraph()
foot=sec.footer.paragraphs[0];foot.alignment=2;foot.add_run('Nhóm 07 | PRD Web | ')
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');foot._p.append(field)
def p(text='',style=None):return d.add_paragraph(text,style)
def h(text,l=1):d.add_heading(text,l)
def new(text):d.add_page_break();h(text)
def table(headers,rows,widths=None):
    t=d.add_table(rows=1,cols=len(headers));t.autofit=False;t.style='Normal Table'
    widths=[w*16.5/sum(widths) for w in widths] if widths else [16.5/len(headers)]*len(headers)
    for j,w in enumerate(widths):t.columns[j].width=Cm(w)
    for j,x in enumerate(headers):t.rows[0].cells[j].text=x
    for row in rows:
        cs=t.add_row().cells
        for j,v in enumerate(row):cs[j].text=str(v)
    for i,row in enumerate(t.rows):
        pr=row._tr.get_or_add_trPr();pr.append(OxmlElement('w:cantSplit'))
        if i==0:pr.append(OxmlElement('w:tblHeader'))
        for j,c in enumerate(row.cells):
            c.width=Cm(widths[j]);pr=c._tc.get_or_add_tcPr();bord=OxmlElement('w:tcBorders')
            for side in ['top','bottom','left','right']:
                e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'000000');bord.append(e)
            pr.append(bord)
            for pp in c.paragraphs:
                pp.paragraph_format.space_before=Pt(3);pp.paragraph_format.space_after=Pt(3)
                for r in pp.runs:r.font.name='Times New Roman';r.font.size=Pt(10.5);r.bold=i==0
    p();return t
def fig(path,caption):
    d.add_picture(str(path),width=Cm(16));pp=p(caption);pp.alignment=1

# Preserve the substantive overview, scope and general backlog, correcting source claims.
for el in src.element.body:
    if el.tag==qn('w:p'):
        pp=Paragraph(el,src._body);text=pp.text
        if text.startswith('4 Product Backlog'):break
        if el.findall('.//'+qn('w:drawing')):
            fig(Path('PRD_Web_HoanChinh/assets/backlog.png'),'Hình 1 Phân rã Product Backlog');continue
        if not text:
            if el.findall('.//'+qn('w:br')):d.add_page_break()
            continue
        if text.startswith('Hình 1'):continue
        text=clean(text)
        if pp.style.name=='Title':d.add_heading(text,0)
        elif pp.style.name.startswith('Heading'):h(text,int(pp.style.name[-1]))
        else:p(text)
    elif el.tag==qn('w:tbl'):
        tt=Table(el,src._body);rows=[[clean(c.text) for c in r.cells] for r in tt.rows];table(rows[0],rows[1:])

while len(d.paragraphs) and not d.paragraphs[-1].text and not d.paragraphs[-1]._p.findall('.//'+qn('w:drawing')):
    el=d.paragraphs[-1]._p;el.getparent().remove(el)
uc_content=parts['uc_code'].replace("'Hình 2 mô tả luồng nghiệp vụ tổng quan; không thay thế đặc tả chi tiết này.' if idx<6 else 'Không vẽ riêng; luồng được thể hiện trong bảng trên.'", "'Không vẽ riêng; luồng được thể hiện trong bảng trên.'")
uc_content=uc_content.replace("new('4 '+str(idx+1)+' '","new('4.'+str(idx+1)+' '")
exec(uc_content)

new('5 Sơ đồ và luồng nghiệp vụ')
p('Sơ đồ phân rã ở mục 3 liên kết các nhóm mục tiêu với UC01–UC13. Các bảng đặc tả Focused Use Cases là căn cứ cho luồng chi tiết. Chọn chức năng quản lý là thao tác điều hướng, không phải một Use Case.')
p('Du khách mở Web hoặc quét QR, chọn ngôn ngữ, tìm điểm và đọc/nghe nội dung. Khi bật tự động, trình duyệt kiểm tra vị trí và kích hoạt cùng trình phát. Chỉ gửi sự kiện lich_su_nghe khi audio kết thúc theo quy tắc trong PRD.')
p('Quản trị viên đăng nhập rồi chọn một chức năng cần dùng; không phải thực hiện lần lượt tất cả chức năng. Đăng xuất hủy phiên. Những yêu cầu chưa có nơi lưu trong ảnh CSDL được đánh dấu G01–G06 ở mục 8.3.')

def make_diagram(file,boxes,links):
    im=Image.new('RGB',(1500,1100),'white');dr=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',26)
    for a,b in links:
        aa=boxes[a];bb=boxes[b];x,y,w,ht=aa[1:];xx,yy,ww,hh=bb[1:];start=(x+w/2,y+ht);end=(xx+ww/2,yy)
        dr.line((start,end),fill='black',width=3);dr.polygon((end,(end[0]-9,end[1]-15),(end[0]+9,end[1]-15)),fill='black')
    for text,x,y,w,ht in boxes:
        dr.rectangle((x,y,x+w,y+ht),fill='white',outline='black',width=3)
        lines=text.split('\n')
        for j,line in enumerate(lines):dr.text((x+w/2,y+ht/2+(j-(len(lines)-1)/2)*38),line,font=font,anchor='mm',fill='black')
    im.save(OUT/file)
make_diagram('components.png',[
('«component» Web du khách\nNgôn ngữ, nội dung, vị trí, audio',30,20,640,140),('«component» Web quản trị\nQuản lý dữ liệu, thống kê, QR',830,20,640,140),
('«component» API công khai\nĐọc nội dung và ghi sự kiện',30,310,640,140),('«component» API quản trị\nKiểm tra phiên trước khi thao tác',830,310,640,140),
('«component» Xử lý nghiệp vụ\nNội dung, địa điểm, ngôn ngữ, thống kê\nĐồng bộ sự kiện theo ma_su_kien',350,580,800,170),
('«component» Truy cập CSDL\n5 bảng trong ảnh MySQL',30,930,640,140),('«component» Kho tệp\nẢnh và audio theo đường dẫn',830,930,640,140)],[(0,2),(1,3),(2,4),(3,4),(4,5),(4,6)])
make_diagram('deployment.png',[
('«device» Điện thoại du khách\nTrình duyệt chạy Web du khách',30,20,640,140),('«device» Máy tính quản trị\nTrình duyệt chạy Web quản trị',830,20,640,140),
('«node» Máy chủ Web và API\nHTTPS, backend, thống kê và đồng bộ\nXác thực: cách lưu cần chốt G01',350,380,800,180),
('«node» MySQL\n5 bảng theo ảnh mới\nKết nối nội bộ từ backend',30,850,640,180),('«node» Kho tệp\nẢnh và audio\nCó thể cùng máy chủ demo',830,850,640,180)],[(0,2),(1,2),(2,3),(2,4)])
new('6 Component Diagram');fig(OUT/'components.png','Hình 2 Component Diagram')
p('Các khối là thành phần phần mềm; có thể được cài đặt trong cùng backend. API quản trị cần xác thực, nhưng ảnh CSDL chưa thể hiện tài khoản. Không vẽ bảng tài khoản, QR, nhật ký hoặc bản ghi âm riêng như những thành phần dữ liệu đã tồn tại.')
p('duong_dan_am_thanh và am_thanh_hash thuộc noi_dung_diem. ngay_cap_nhat giúp biết lần cập nhật gần nhất, không thay thế kho phiên bản hoặc nhật ký. Dịch vụ bản đồ nền là phụ thuộc ngoài của trình duyệt; không phải bảng trong CSDL.')
new('7 Deployment Diagram');fig(OUT/'deployment.png','Hình 3 Deployment Diagram')
p('Trình duyệt gọi Web/API qua HTTPS. Backend truy cập MySQL và kho tệp; trình duyệt không truy cập MySQL trực tiếp. Trình duyệt lấy bản đồ nền qua HTTPS từ nhà cung cấp được chọn; vị trí du khách được xử lý tại trình duyệt.')
p('Máy chủ Web/API, MySQL và kho tệp có thể cùng một máy ở môi trường demo. Hosting, framework và cách lưu tài khoản/cấu hình chưa được ảnh CSDL xác định; không coi một phương án chưa chọn là hệ thống đã triển khai.')
exec(parts['data'])

# Rules reference the five-table model without assuming missing columns.
new('9 Quy tắc nghiệp vụ')
rules=[('BR01','Du khách không đăng nhập; ma_phien là mã phiên ẩn danh, không đồng nghĩa số người thực.'),('BR02','Ghi luot_truy_cap bằng ma_su_kien. Chống gửi lại cần xác nhận UNIQUE và xử lý backend; chưa có nguồn QR trong bảng.'),('BR03','Chỉ hiển thị điểm đang dùng và bài đủ trạng thái công bố. Thiếu bản dịch dùng ngôn ngữ mặc định.'),('BR04','Khoảng cách Haversine không vượt bán kính và có mẫu vị trí hợp lệ trong ít nhất 3 giây.'),('BR05','Vị trí cũ hoặc sai số lớn hơn bán kính không dùng để tự phát. Không gửi tọa độ khách về máy chủ hệ thống.'),('BR06','Vùng chồng chọn tâm gần nhất; không ngắt bài; không tự phát lại cùng điểm trong 10 phút.'),('BR07','Ghi sự kiện lich_su_nghe khi audio kết thúc; dùng ma_su_kien để đối chiếu gửi lại. Không giả định có cột trạng thái nghe.'),('BR08','Ẩn điểm bằng dang_dung; không xóa lịch sử. Xóa/ẩn bài phải kiểm tra ENUM và FK thực tế.'),('BR09','Công bố bài cần văn bản và audio phù hợp. Audio hiện tại nằm trong noi_dung_diem. Cần xác nhận UNIQUE điểm–ngôn ngữ.'),('BR10','Nhật ký và phiên bản cũ là yêu cầu chưa có nơi lưu trong ảnh; cần giải quyết G03/G04.'),('BR11','Cảnh báo vùng chồng trước khi lưu; bán kính mặc định chỉ dùng cho điểm mới. Cấu hình lưu ở đâu thuộc G02.'),('BR12','Thống kê theo UTC+7; loại trùng khi nối lịch sử nghe; tách môi trường demo vì ảnh không có cờ demo.'),('BR13','Ngôn ngữ mới mặc định tắt; luôn một ngôn ngữ mặc định; không xóa ngôn ngữ đang được tham chiếu.'),('BR14','Quản trị cần phiên hợp lệ; sai thông tin không tạo phiên, đăng xuất hủy phiên. G01 xác định nơi lưu tài khoản.')]
table(['Mã','Quy tắc'],rules,[1.5,15])
new('10 Yêu cầu chức năng và phi chức năng')
table(['Mã','Yêu cầu chức năng','UC'],[(f'FR{i+1:02d}',title,uc) for i,(uc,title,*_) in enumerate(stories)],[1.5,12.5,2.5])
p('User Stories và tiêu chí nghiệm thu ở mục 4 là cơ sở kiểm thử từng yêu cầu. FR mô tả chức năng; UC mô tả tương tác; tiêu chí nghiệm thu xác định điều kiện kiểm tra kết quả. Ba khái niệm được trình bày tách biệt.')
table(['Nhóm','Yêu cầu phi chức năng'],[('Hiệu năng','Mục tiêu tải danh sách và bắt đầu audio trong 2 giây trên môi trường kiểm thử đã ghi nhận.'),('Tương thích','Kiểm thử Web trên điện thoại và máy tính; có nghe thủ công khi định vị hoặc tự phát bị chặn.'),('Bảo mật','HTTPS, kiểm tra phiên ở API quản trị, mật khẩu băm theo cơ chế xác thực được chọn; kiểm tra dữ liệu và tệp phía máy chủ.'),('Quyền riêng tư','Không lưu tọa độ du khách; ip_ma_hoa không được dùng để lưu IP gốc; thuật toán xử lý cần thống nhất.'),('Toàn vẹn','Kiểm tra FK/UNIQUE trong DDL, chống trùng sự kiện, không xóa lịch sử dây chuyền; không giả định trường chưa có.'),('Khả năng sử dụng','Giao diện đáp ứng, chữ rõ, có văn bản kèm audio, lỗi dễ hiểu; nút thao tác chính đủ lớn cho màn hình cảm ứng.')],[3.5,13])
new('11 Kế hoạch nghiệm thu và nội dung cần chốt')
p('Nghiệm thu theo từng tiêu chí trong bảng User Story. Ghi thiết bị, phiên bản trình duyệt, điều kiện mạng, dữ liệu vào, thao tác, kết quả mong đợi và kết quả thực tế. Không ghi kết quả đạt nếu chưa chạy thử.')
p('Đối chiếu CSDL trước khi hoàn thiện triển khai: cung cấp DDL hoặc file mô hình để xác nhận ENUM, Indexes, NULL, mặc định, UNIQUE và hành động khóa ngoại. Ảnh hiện tại đủ để xác định năm bảng và các cột, chưa đủ để khẳng định toàn bộ ràng buộc.')
p('Các vấn đề G01–G06 cần được giải quyết trước khi nghiệm thu các yêu cầu phụ thuộc. Không tự bỏ yêu cầu nhật ký, phiên bản, QR hoặc xác thực; cũng không tự thêm bảng để coi khoảng trống đã được giải quyết.')
p('Bộ ca tối thiểu: đổi ngôn ngữ; tìm và xem điểm; nghe hết và gửi lại cùng mã sự kiện; từ chối quyền vị trí; vùng chồng; không ngắt bài; đăng nhập sai; lọc và xuất lịch sử; sửa/ẩn điểm giữ lịch sử; thay audio cập nhật hash; vô hiệu hóa QR theo cơ chế cấu hình đã chốt.')
d.core_properties.title='PRD Web thuyết minh du lịch theo mẫu Focused Use Cases'
d.core_properties.author='Nhóm 07'
d.save(OUT/'PRD_Web_DaSua_TheoMau.docx')
print((OUT/'PRD_Web_DaSua_TheoMau.docx').resolve())
print('UC:',len(stories),'Tables:',len(d.tables),'Figures:',len(d.inline_shapes))

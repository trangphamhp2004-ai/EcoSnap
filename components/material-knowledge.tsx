'use client';
import React,{useState} from 'react';
import {BookOpen,CheckCircle2,Search,RefreshCw} from 'lucide-react';

const sources={
 vn:{name:'Bộ TN&MT · Hướng dẫn phân loại',url:'https://vea.mae.gov.vn/Data/files/2023/CV9368/9368-btnmt-kson_Signed.pdf'},
 recycle:{name:'EPA · Vật liệu tái chế',url:'https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables'},
 resin:{name:'NIH · Mã nhận diện nhựa',url:'https://orf.od.nih.gov/EnvironmentalProtection/WasteDisposal/Pages/PlasticResinCodes.aspx'},
 plasticUse:{name:'CFS · Dùng bao bì nhựa đúng cách',url:'https://www.cfs.gov.hk/english/multimedia/multimedia_pub/multimedia_pub_fsb_201504.html'},
 duytan:{name:'DUYTAN · Thu gom PET, HDPE tại Việt Nam',url:'https://duytanrecycling.com/vi/quy-trinh-thu-gom/'},
 hazard:{name:'EPA · Chất thải nguy hại gia đình',url:'https://www.epa.gov/hw/household-hazardous-waste-hhw'},
 glass:{name:'Hong Kong EPD · Phân biệt vật liệu',url:'https://www.wastereduction.gov.hk/en-hk/recycling-faq/greencommunity-faq'},
 aerosol:{name:'EPA New Zealand · Bình xịt có áp suất',url:'https://www.epa.govt.nz/everyday-environment/aerosols/'},
 battery:{name:'EPA · Pin lithium đã dùng',url:'https://www.epa.gov/recycle/used-lithium-ion-batteries'},
 compost:{name:'EPA · Ủ tại nhà',url:'https://www.epa.gov/recycle/composting-home'},
 electronics:{name:'Việt Nam Tái Chế · Điều kiện tiếp nhận',url:'https://vietnamrecycles.com/faq-vn'},
};
type Topic={id:string;label:string;title:string;intro:string;recover:string;separate:string;reuse:string;sources:(keyof typeof sources)[]};
const topics:Topic[]=[
 {id:'unknown',label:'Chưa rõ vật liệu',title:'Chưa rõ thì kiểm tra gì?',intro:'Không cần biết nhãn hiệu để nhận ra từng phần. Nhưng hình dáng hoặc màu sắc chưa đủ cho biết loại nhựa, chất từng chứa hay khả năng dùng lại.',recover:'Tìm tên vật liệu, ký hiệu ở đáy và nhãn sản phẩm. Xác định đồ vật từng chứa gì; hỏi nơi nhận về đúng loại đồ đó.',separate:'Chai còn chất lỏng chưa rõ: giữ kín, chưa đổ hoặc rửa. Bao bì rỗng vẫn có thể còn cặn hóa chất.',reuse:'Chỉ dùng lại khi đã rõ công dụng và tình trạng. Mở “Tìm hiểu vật liệu khác” để đọc thêm; lựa chọn này không xác nhận hay đổi kết quả phân loại.',sources:['recycle','hazard']},
 {id:'plastic',label:'Nhựa',title:'Chai, hộp và túi nhựa',intro:'Mã nhựa cho biết vật liệu, không phải số lần được dùng lại hay cam kết nơi thu gom sẽ nhận.',recover:'Chai PET (1), HDPE (2) có kênh thu gom tại Việt Nam, ví dụ mạng lưới DUYTAN. Kiểm tra điều kiện của điểm nhận; túi mềm, hộp và phụ kiện có thể cần kênh khác.',separate:'Chưa đọc được mã: xem đáy hoặc nhãn, không đoán từ ảnh. Hộp xốp và đồ nhựa dùng một lần theo hướng dẫn nền thuộc nhóm rác còn lại.',reuse:'Làm theo hướng dẫn của nhà sản xuất về dùng lại, nhiệt độ và thực phẩm phù hợp. Làm sạch, để khô; ngừng dùng đồ nứt, hỏng. Mã PP (5) không tự xác nhận dùng được trong lò vi sóng.',sources:['resin','duytan','plasticUse','vn']},
 {id:'glass',label:'Thủy tinh',title:'Chai, lọ thủy tinh',intro:'Chai đồ uống, lọ thực phẩm và cốc chịu nhiệt có thể cần cách thu gom khác nhau.',recover:'Chai, lọ thông thường không nhiễm chất nguy hại có thể chuyển cho nơi nhận thủy tinh. Kiểm tra yêu cầu về màu, nắp và tình trạng nguyên vẹn.',separate:'Giữ mảnh vỡ an toàn, tránh gây đứt tay. Không tự gom gốm sứ, gương, kính cửa hoặc đồ chịu nhiệt cùng chai lọ; hỏi điểm nhận. Đèn huỳnh quang, nhiệt kế thủy ngân cần tuyến riêng.',reuse:'Chỉ cân nhắc chai, lọ nguyên vẹn và phù hợp mục đích. Đừng suy ra khả năng chịu nhiệt hoặc dùng trong lò chỉ vì đồ vật làm bằng thủy tinh.',sources:['glass','vn']},
 {id:'metal',label:'Kim loại',title:'Lon, hộp và đồ kim loại',intro:'Cùng là kim loại nhưng lon thực phẩm và bình có áp suất cần được kiểm tra khác nhau.',recover:'Lon thực phẩm, đồ uống đã hết phần chứa có thể gom theo yêu cầu của nơi nhận. Chú ý cạnh sắc và phân loại nắp, bộ phận khác riêng.',separate:'Bình xịt còn sản phẩm, bình khí hoặc bao bì hóa chất cần hỏi đơn vị tiếp nhận. Không tự chọc thủng hay đốt để làm rỗng.',reuse:'Ưu tiên đồ còn nguyên vẹn, không có cạnh sắc. Bao bì từng chứa hóa chất không dùng lại để đựng thức ăn hoặc nước uống.',sources:['recycle','aerosol','hazard']},
 {id:'paper',label:'Giấy',title:'Giấy, bìa và bao bì nhiều lớp',intro:'Độ sạch và lớp phủ ảnh hưởng đến cách thu hồi giấy.',recover:'Giữ giấy, bìa sạch và khô; tách phần không phải giấy. Chỉ chuyển đến nơi có nhận loại bao bì đó.',separate:'Giấy thấm dầu, giấy ăn đã dùng và giấy ghép nhựa hoặc bạc cần xem riêng. Không mặc định chúng giống bìa carton sạch; không rửa giấy để tái chế.',reuse:'Giấy sạch còn dùng được có thể dùng làm giấy nháp hoặc đóng gói. Với hộp sữa, cốc giấy hay đế bánh, hỏi đúng kênh thu gom bao bì nhiều lớp.',sources:['vn','recycle']},
 {id:'fabric',label:'Vải',title:'Quần áo và đồ vải',intro:'Tách đồ còn dùng được khỏi đồ hỏng và đồ nhiễm hóa chất.',recover:'Đồ sạch, còn sử dụng tốt có thể cho tặng nếu nơi nhận có nhu cầu. Đồ rách cần kiểm tra kênh thu hồi vải, không mặc định mọi điểm đều nhận.',separate:'Vải dính dầu công nghiệp hoặc hóa chất nguy hại cần thu gom riêng, không trộn với quần áo cho tặng.',reuse:'Có thể sửa hoặc tận dụng đồ vải sạch. Kiểm tra điều kiện vệ sinh, loại đồ và tình trạng mà nơi nhận yêu cầu.',sources:['vn']},
 {id:'organic',label:'Thực phẩm, cây lá',title:'Thức ăn thừa và rác làm vườn',intro:'Có nguồn gốc hữu cơ không có nghĩa tất cả đều cùng một nhóm hoặc đều phù hợp với mọi cách ủ.',recover:'Tách phần thực phẩm bỏ đi khỏi bao bì. Nếu có nơi nhận để ủ, kiểm tra những loại họ chấp nhận.',separate:'Túi, dây buộc, nhựa và thủy tinh không đi cùng phần thực phẩm. Bã trà, cà phê và lá cây có hướng dẫn nền riêng; làm theo kết quả ở trên và cách thu gom tại nơi ở.',reuse:'Không suy ra thực phẩm còn ăn được chỉ từ ảnh. Ủ tại nhà cần cách làm phù hợp; thịt, cá, sữa và nhiều dầu mỡ thường cần phương pháp hoặc cơ sở thích hợp.',sources:['vn','compost']},
 {id:'electronic',label:'Điện tử, pin, đèn',title:'Đồ điện tử và vật cần thu gom riêng',intro:'Khả năng thu hồi vật liệu không có nghĩa được bỏ chung với chai, giấy và lon.',recover:'Chuyển thiết bị nguyên dạng đến chương trình có nhận đúng loại đồ. Pin, ắc quy và đèn chứa thủy ngân cần điểm tiếp nhận phù hợp.',separate:'Không tự tháo, đập hoặc làm vỡ. Pin phồng, nóng, rò rỉ hoặc đèn vỡ cần hướng dẫn riêng từ đơn vị tiếp nhận.',reuse:'Thiết bị còn hoạt động có thể sửa hoặc chuyển cho người cần. Xóa dữ liệu cá nhân trước khi giao điện thoại, máy tính.',sources:['vn','battery','electronics','recycle']},
 {id:'hazard',label:'Bao bì hóa chất',title:'Chai, lọ từng chứa chất nguy hại',intro:'Chất từng chứa quan trọng không kém vật liệu làm vỏ.',recover:'Đọc nhãn và liên hệ nơi tiếp nhận chất thải nguy hại. Vỏ rỗng có thể còn cặn; không tự coi là bao bì tái chế thông thường.',separate:'Giữ nguyên nhãn; không trộn phần dư, đổ xuống cống hoặc rửa để gom tái chế. Áp dụng với chất có cảnh báo nguy hại, không mặc định mọi mỹ phẩm đều thuộc loại này.',reuse:'Không dùng bao bì hóa chất cho thực phẩm hoặc nước uống. Hỏi đơn vị tiếp nhận về cách giữ và giao đúng loại sản phẩm.',sources:['hazard','vn']},
];
const topicByRule:Record<string,string>={
 bottle:'plastic','plastic-container':'plastic','single-use':'plastic',foam:'plastic','plastic-bag':'plastic',
 glass:'glass','glass-broken':'glass',metal:'metal',paper:'paper','dirty-paper':'paper',laminated:'paper',tissue:'paper',
 clothes:'fabric','hazardous-fabric':'hazard',food:'organic',garden:'organic',electronics:'electronic',battery:'electronic',lamp:'electronic',hazardous:'hazard',
 'unknown-container':'unknown','unknown-liquid':'unknown','unknown-accessory':'unknown','unknown-item':'unknown','product-residue':'unknown','drink-residue':'unknown',
};
const resinCodes=[['1','PET / PETE','Chai nước, chai dầu ăn'],['2','HDPE','Chai sữa, chai dầu gội'],['3','PVC','Một số bao bì trong, vỉ nhựa'],['4','LDPE','Túi mềm, chai bóp'],['5','PP','Hộp sữa chua, một số chai gia vị'],['6','PS','Cốc, khay, vật liệu xốp'],['7','OTHER','Nhựa khác hoặc hỗn hợp']];

export function MaterialKnowledge({ruleIds}:{ruleIds:string[]}){
 const relevant=[...new Set(ruleIds.map(id=>topicByRule[id]||'unknown'))];
 const [selected,setSelected]=useState(relevant.includes('unknown')?'unknown':relevant[0]||'unknown');
 const topic=topics.find(t=>t.id===selected)!;
 const needsContentsCheck=ruleIds.some(id=>['unknown-liquid','product-residue','drink-residue'].includes(id));
 const topicButton=(t:Topic)=><button type="button" key={t.id} aria-pressed={selected===t.id} onClick={()=>setSelected(t.id)}>{t.label}</button>;
 return <section className="card material-knowledge" aria-labelledby="material-knowledge-title">
  <div className="eyebrow"><BookOpen size={18} aria-hidden="true"/>Kiến thức liên quan</div>
  <h2 id="material-knowledge-title">Hiểu vật liệu, xử lý đúng cách</h2>
  <p className="material-intro">Tìm hiểu khả năng tái chế và cách dùng lại cho từng loại đồ vật.</p>
  {needsContentsCheck&&<p className="material-caution">Với phần chứa chưa rõ hoặc chưa có cách xử lý: giữ nguyên, kiểm tra nhãn trước khi đổ hay rửa vỏ.</p>}
  <div className="material-topics" aria-label="Chủ đề liên quan đến kết quả">{topics.filter(t=>relevant.includes(t.id)).map(topicButton)}</div>
  <details className="material-explore"><summary>Tìm hiểu vật liệu khác</summary><div className="material-topics" aria-label="Các chủ đề khác">{topics.filter(t=>!relevant.includes(t.id)).map(topicButton)}</div><p>Chọn để đọc kiến thức; kết quả phân loại ở trên được giữ nguyên.</p></details>
  <div className="material-panel" aria-live="polite" aria-atomic="true">
   <h3>{topic.title}</h3><p>{topic.intro}</p>
   <div className="material-guidance"><div><CheckCircle2 size={20} aria-hidden="true"/><div><h4>Điều kiện thu hồi</h4><p>{topic.recover}</p></div></div><div><Search size={20} aria-hidden="true"/><div><h4>Cần tách riêng hoặc kiểm tra</h4><p>{topic.separate}</p></div></div><div><RefreshCw size={20} aria-hidden="true"/><div><h4>Lưu ý khi dùng lại</h4><p>{topic.reuse}</p></div></div></div>
   {selected==='plastic'&&<details className="resin-guide"><summary>Đọc mã nhựa 1–7 ở đáy hoặc trên nhãn</summary><p>Ví dụ dưới đây giúp nhận biết ký hiệu. Hãy đọc mã thực tế; không suy mã chỉ từ loại sản phẩm.</p><dl className="resin-codes">{resinCodes.map(([code,name,example])=><div key={code}><dt><span>{code}</span>{name}</dt><dd>{example}</dd></div>)}</dl><p>Mã 7 không tự có nghĩa là độc; mã 1, 2 hay 5 cũng không bảo đảm mọi cách dùng đều an toàn. Xem hướng dẫn của nhà sản xuất và nơi thu gom.</p></details>}
   <div className="material-sources"><span>Nguồn đối chiếu · 04/10/2026</span>{topic.sources.map(key=><a key={key} href={sources[key].url} target="_blank" rel="noreferrer">{sources[key].name}</a>)}</div>
  </div>
  <p className="material-local-note">Điểm tiếp nhận quyết định loại đồ và tình trạng được nhận. Nguồn quốc tế dùng để giải thích vật liệu; cách thu gom thực hiện theo hướng dẫn tại Việt Nam và nơi bạn ở.</p>
 </section>;
}

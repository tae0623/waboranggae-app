package kr.co.waboranggae.nativepilot.data
import kotlin.math.*
data class InsertionCandidate(val place:Place,val index:Int,val detourKm:Double)
fun routeDistance(a:Coordinate,b:Coordinate):Double{
 val rad=Math.PI/180;val dy=(b.latitude-a.latitude)*rad;val dx=(b.longitude-a.longitude)*rad
 val v=sin(dy/2).pow(2)+cos(a.latitude*rad)*cos(b.latitude*rad)*sin(dx/2).pow(2)
 return 6371*2*atan2(sqrt(v),sqrt(max(0.0,1-v)))
}
fun nearbyAdditions(route:List<Place>,pool:List<Place>,origin:Coordinate?,excluded:Set<String> = emptySet()):List<InsertionCandidate>{
 val used=route.map{it.id}.toSet()+excluded
 return pool.distinctBy{it.id}.filter{it.id !in used && it.category!="station" && route.none{p->p.name.replace(" ","")==it.name.replace(" ","")}}.mapNotNull{place->
  val point=place.coordinate()?:return@mapNotNull null
  (0..route.size).mapNotNull{index->
   val before=if(index==0)origin else route[index-1].coordinate()
   val after=route.getOrNull(index)?.coordinate()
   if(before==null&&after==null)return@mapNotNull null
   val extra=(before?.let{routeDistance(it,point)}?:0.0)+(after?.let{routeDistance(point,it)}?:0.0)-(if(before!=null&&after!=null)routeDistance(before,after)else 0.0)
   InsertionCandidate(place,index,max(0.0,extra))
  }.minByOrNull{it.detourKm}
 }.sortedBy{it.detourKm}
}

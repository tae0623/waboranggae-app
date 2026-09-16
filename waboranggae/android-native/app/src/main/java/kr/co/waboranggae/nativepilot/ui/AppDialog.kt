package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

/** Shared app-theme sheet: consent, errors and destructive confirmations retain their full meaning. */
@Composable fun AppDialog(onDismissRequest:()->Unit,confirmButton:@Composable ()->Unit,
    modifier:Modifier=Modifier,dismissButton:(@Composable ()->Unit)?=null,
    title:(@Composable ()->Unit)?=null,text:(@Composable ()->Unit)?=null) {
    Dialog(onDismissRequest=onDismissRequest) {
        Surface(modifier.fillMaxWidth(),shape=RoundedCornerShape(28.dp),color=Color.White,
            border=BorderStroke(1.dp,Color(0xFFE5EAE5)),shadowElevation=12.dp) {
            Column(Modifier.padding(24.dp),verticalArrangement=Arrangement.spacedBy(20.dp)) {
                Box(Modifier.size(36.dp,5.dp).background(Color(0xFFBBF7D0),RoundedCornerShape(20.dp)))
                title?.let{ProvideTextStyle(MaterialTheme.typography.titleLarge.copy(color=Ink,fontWeight=FontWeight.Bold)){it()}}
                text?.let{Box(Modifier.heightIn(max=400.dp).verticalScroll(rememberScrollState())){
                    ProvideTextStyle(MaterialTheme.typography.bodyMedium.copy(color=Muted)){it()}
                }}
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                    dismissButton?.let{Box(Modifier.weight(1f).background(Soft,RoundedCornerShape(16.dp)),contentAlignment=androidx.compose.ui.Alignment.Center){
                        MaterialTheme(colorScheme=MaterialTheme.colorScheme.copy(primary=Ink)){it()}
                    }}
                    Box(Modifier.weight(1f).background(Ink,RoundedCornerShape(16.dp)),contentAlignment=androidx.compose.ui.Alignment.Center){
                        MaterialTheme(colorScheme=MaterialTheme.colorScheme.copy(primary=Color.White)){confirmButton()}
                    }
                }
            }
        }
    }
}
